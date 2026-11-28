import { asc, eq } from 'drizzle-orm';
import { db, type Database, type Transaction } from '../../database/client.js';
import { lockRecipeGraph } from '../../database/locks.js';
import { products, recipes } from '../../database/schema/index.js';
import { recordAudit } from '../../shared/audit.js';
import { isUniqueViolation } from '../../shared/database-errors.js';
import { AppError, NotFoundError, ValidationError } from '../../shared/errors.js';
import { loadCatalog } from '../recipes/recipes.service.js';
import { getPricingSettings } from '../settings/pricing-settings.service.js';
import { calculateProductPricing, type PricingSettingsValues } from './pricing.js';

export type ProductInput = {
  name: string;
  recipeId: number;
  recipeQuantity: number;
  priceCents: number;
  notes?: string | null;
};

export type ProductChanges = Partial<ProductInput & { isActive: boolean }>;

type Executor = Database | Transaction;
type ProductRow = typeof products.$inferSelect;
type Catalog = Awaited<ReturnType<typeof loadCatalog>>;

const NAME_TAKEN = () => new AppError(409, 'PRODUCT_NAME_TAKEN', 'Já existe um produto com este nome');
const NOT_FOUND = () => new NotFoundError('Produto não encontrado');

function rethrowNameTaken(err: unknown): never {
  if (isUniqueViolation(err, 'products_name_lower_unique')) throw NAME_TAKEN();
  throw err;
}

/** O produto com custos, lucro, margem e preço sugerido calculados na hora (decisão AO). */
function toProductDto(row: ProductRow, catalog: Catalog, settings: PricingSettingsValues) {
  const recipe = catalog.recipeById.get(row.recipeId)!;
  // Custo da ficha por unidade do rendimento × quanto dela vai no produto (com decimais).
  const directCostCents = catalog.calc.costPerYieldUnitCents(row.recipeId) * row.recipeQuantity;

  return {
    id: row.id,
    name: row.name,
    recipe: { id: recipe.id, name: recipe.name, yieldUnit: recipe.yieldUnit, isActive: recipe.isActive },
    recipeQuantity: row.recipeQuantity,
    priceCents: row.priceCents,
    notes: row.notes,
    isActive: row.isActive,
    updatedAt: row.updatedAt,
    ...calculateProductPricing(directCostCents, row.priceCents, settings),
  };
}

export type ProductDto = ReturnType<typeof toProductDto>;

export async function listProducts(filter: { status: 'active' | 'archived' | 'all' }): Promise<ProductDto[]> {
  const catalog = await loadCatalog(db);
  const settings = await getPricingSettings();
  const rows = await db
    .select()
    .from(products)
    .where(filter.status === 'all' ? undefined : eq(products.isActive, filter.status === 'active'))
    .orderBy(asc(products.name));

  return rows.map((row) => toProductDto(row, catalog, settings));
}

export async function getProduct(id: number, executor: Executor = db): Promise<ProductDto> {
  const [row] = await executor.select().from(products).where(eq(products.id, id)).limit(1);
  if (!row) throw NOT_FOUND();
  return toProductDto(row, await loadCatalog(executor), await getPricingSettings(executor));
}

async function assertRecipeExists(tx: Transaction, recipeId: number): Promise<void> {
  const [recipe] = await tx.select({ id: recipes.id }).from(recipes).where(eq(recipes.id, recipeId));
  if (!recipe) {
    const message = 'Ficha técnica não encontrada';
    throw new ValidationError(message, [{ field: 'recipeId', message }]);
  }
}

export async function createProduct(input: ProductInput, actorUserId: number): Promise<ProductDto> {
  const values = { ...input, notes: input.notes ?? null };

  try {
    return await db.transaction(async (tx) => {
      // Mesma trava das fichas: a troca de unidade de uma ficha confere quem a usa (decisão AV)
      // e não pode deixar passar um produto criado ao mesmo tempo.
      await lockRecipeGraph(tx);
      await assertRecipeExists(tx, input.recipeId);

      const [row] = await tx.insert(products).values(values).returning();
      await recordAudit(tx, {
        userId: actorUserId,
        entityType: 'product',
        entityId: row!.id,
        action: 'create',
        changes: values,
      });
      return getProduct(row!.id, tx);
    });
  } catch (err) {
    rethrowNameTaken(err);
  }
}

export async function updateProduct(
  id: number,
  changes: ProductChanges,
  actorUserId: number,
): Promise<ProductDto> {
  try {
    return await db.transaction(async (tx) => {
      // Trava do mapa antes da linha do produto, na mesma ordem das fichas (evita deadlock).
      if (changes.recipeId !== undefined) await lockRecipeGraph(tx);

      const [current] = await tx.select().from(products).where(eq(products.id, id)).for('update');
      if (!current) throw NOT_FOUND();

      const patch: Record<string, unknown> = {};
      const diff: Record<string, { from: unknown; to: unknown }> = {};
      for (const [field, to] of Object.entries(changes)) {
        if (to === undefined) continue;
        const from = current[field as keyof ProductChanges];
        if (from !== to) {
          patch[field] = to;
          diff[field] = { from, to };
        }
      }

      if (Object.keys(patch).length === 0) return getProduct(id, tx);
      if (patch.recipeId !== undefined) await assertRecipeExists(tx, patch.recipeId as number);

      await tx.update(products).set(patch).where(eq(products.id, id));
      // A auditoria guarda a mudança de preço: responde "quando o bolo passou a custar R$ 130?".
      await recordAudit(tx, {
        userId: actorUserId,
        entityType: 'product',
        entityId: id,
        action: 'update',
        changes: diff,
      });
      return getProduct(id, tx);
    });
  } catch (err) {
    rethrowNameTaken(err);
  }
}
