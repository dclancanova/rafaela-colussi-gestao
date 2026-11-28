import { asc, eq, inArray } from 'drizzle-orm';
import { db, type Database, type Transaction } from '../../database/client.js';
import { lockRecipeGraph } from '../../database/locks.js';
import { products, recipeItems, recipes, supplies } from '../../database/schema/index.js';
import { recordAudit } from '../../shared/audit.js';
import { isUniqueViolation } from '../../shared/database-errors.js';
import { AppError, NotFoundError, ValidationError } from '../../shared/errors.js';
import type { MeasurementUnit } from '../supplies/supplies.service.js';
import {
  createRecipeCostCalculator,
  findCycleCulprit,
  type CostRecipe,
  type CostSupply,
} from './recipe-cost.js';

/** Uma linha da ficha, como a API recebe: insumo (supplyId) OU sub-receita (recipeId). */
export type RecipeItemInput = { supplyId?: number; recipeId?: number; quantity: number };

export type RecipeInput = {
  name: string;
  yieldQuantity: number;
  yieldUnit: MeasurementUnit;
  notes?: string | null;
  items: RecipeItemInput[];
};

export type RecipeChanges = Partial<RecipeInput & { isActive: boolean }>;

type Executor = Database | Transaction;
type RecipeRow = typeof recipes.$inferSelect;
type ItemRow = typeof recipeItems.$inferSelect;

const NAME_TAKEN = () => new AppError(409, 'RECIPE_NAME_TAKEN', 'Já existe uma ficha técnica com este nome');
const NOT_FOUND = () => new NotFoundError('Ficha técnica não encontrada');

function rethrowNameTaken(err: unknown): never {
  if (isUniqueViolation(err, 'recipes_name_lower_unique')) throw NAME_TAKEN();
  throw err;
}

/**
 * Lê tudo o que o cálculo de custo precisa, de uma vez.
 * Os dados de uma confeitaria (centenas de linhas) cabem folgados na memória, e assim
 * uma ficha com sub-receitas em vários níveis custa 3 consultas, e não uma por nível.
 */
export async function loadCatalog(executor: Executor) {
  const supplyRows = await executor.select().from(supplies);
  const recipeRows = await executor.select().from(recipes).orderBy(asc(recipes.name));
  const itemRows = await executor.select().from(recipeItems).orderBy(asc(recipeItems.position));

  const itemsByRecipe = new Map<number, ItemRow[]>();
  for (const item of itemRows) {
    const list = itemsByRecipe.get(item.recipeId) ?? [];
    list.push(item);
    itemsByRecipe.set(item.recipeId, list);
  }

  const costSupplies = new Map<number, CostSupply>(supplyRows.map((row) => [row.id, row]));
  const costRecipes = new Map<number, CostRecipe>(
    recipeRows.map((row) => [
      row.id,
      { yieldQuantity: row.yieldQuantity, items: itemsByRecipe.get(row.id) ?? [] },
    ]),
  );

  return {
    supplyById: new Map(supplyRows.map((row) => [row.id, row])),
    recipeRows,
    recipeById: new Map(recipeRows.map((row) => [row.id, row])),
    itemRows,
    itemsByRecipe,
    calc: createRecipeCostCalculator(costSupplies, costRecipes),
  };
}

type Catalog = Awaited<ReturnType<typeof loadCatalog>>;

function toSummary(row: RecipeRow, catalog: Catalog) {
  const total = catalog.calc.totalCostCents(row.id);
  return {
    id: row.id,
    name: row.name,
    yieldQuantity: row.yieldQuantity,
    yieldUnit: row.yieldUnit,
    notes: row.notes,
    isActive: row.isActive,
    updatedAt: row.updatedAt,
    itemCount: catalog.itemsByRecipe.get(row.id)?.length ?? 0,
    // Decisão AF: o total é arredondado uma vez, aqui...
    totalCostCents: Math.round(total),
    // ...e o custo por unidade vem do total SEM arredondar (vira insumo de outras fichas).
    costPerYieldUnitCents: total / row.yieldQuantity,
  };
}

export type RecipeSummary = ReturnType<typeof toSummary>;

function toDetail(row: RecipeRow, catalog: Catalog) {
  const items = (catalog.itemsByRecipe.get(row.id) ?? []).map((item) => {
    const costCents = catalog.calc.itemCostCents(item);
    if (item.supplyId !== null) {
      const supply = catalog.supplyById.get(item.supplyId)!;
      return {
        kind: 'supply' as const,
        id: supply.id,
        name: supply.name,
        unit: supply.unit,
        isActive: supply.isActive,
        quantity: item.quantity,
        costCents,
      };
    }
    const sub = catalog.recipeById.get(item.subRecipeId!)!;
    return {
      kind: 'recipe' as const,
      id: sub.id,
      name: sub.name,
      unit: sub.yieldUnit,
      isActive: sub.isActive,
      quantity: item.quantity,
      costCents,
    };
  });

  // Fichas que usam esta como sub-receita: aparecem na tela e explicam por que a unidade não pode mudar.
  const usedIn = catalog.itemRows
    .filter((item) => item.subRecipeId === row.id)
    .map((item) => catalog.recipeById.get(item.recipeId)!)
    .map((parent) => ({ id: parent.id, name: parent.name }));

  return { ...toSummary(row, catalog), items, usedIn };
}

export type RecipeDetail = ReturnType<typeof toDetail>;

export async function listRecipes(filter: {
  status: 'active' | 'archived' | 'all';
}): Promise<RecipeSummary[]> {
  const catalog = await loadCatalog(db);
  return catalog.recipeRows
    .filter((row) => filter.status === 'all' || row.isActive === (filter.status === 'active'))
    .map((row) => toSummary(row, catalog));
}

export async function getRecipe(id: number, executor: Executor = db): Promise<RecipeDetail> {
  const catalog = await loadCatalog(executor);
  const row = catalog.recipeById.get(id);
  if (!row) throw NOT_FOUND();
  return toDetail(row, catalog);
}

/** Forma única de comparar listas de itens (a do banco e a recebida), na mesma ordem. */
function normalizeItems(items: RecipeItemInput[]): RecipeItemInput[] {
  return items.map((item) =>
    item.supplyId !== undefined
      ? { supplyId: item.supplyId, quantity: item.quantity }
      : { recipeId: item.recipeId!, quantity: item.quantity },
  );
}

function itemsFromRows(rows: ItemRow[]): RecipeItemInput[] {
  return normalizeItems(
    rows.map((row) =>
      row.supplyId !== null
        ? { supplyId: row.supplyId, quantity: row.quantity }
        : { recipeId: row.subRecipeId!, quantity: row.quantity },
    ),
  );
}

function itemError(index: number, message: string): ValidationError {
  // Mesmo formato dos erros do Zod: a tela mostra a mensagem do primeiro campo.
  return new ValidationError(message, [{ field: `items.${index}`, message }]);
}

/**
 * Confere os itens contra o banco: componentes existem, nada repetido, nada usando a si mesmo
 * e nenhum ciclo. `recipeId` é null ao criar (ninguém usa uma receita nova, então não há ciclo).
 */
async function validateItems(tx: Transaction, recipeId: number | null, items: RecipeItemInput[]) {
  const seen = new Set<string>();
  items.forEach((item, index) => {
    const key = item.supplyId !== undefined ? `s${item.supplyId}` : `r${item.recipeId}`;
    if (seen.has(key)) throw itemError(index, 'O mesmo item aparece duas vezes na ficha');
    seen.add(key);
    if (recipeId !== null && item.recipeId === recipeId) {
      throw itemError(index, 'Uma ficha técnica não pode usar a si mesma');
    }
  });

  const supplyIds = items.flatMap((item) => (item.supplyId !== undefined ? [item.supplyId] : []));
  const subRecipeIds = items.flatMap((item) => (item.recipeId !== undefined ? [item.recipeId] : []));

  const foundSupplies = supplyIds.length
    ? await tx.select({ id: supplies.id }).from(supplies).where(inArray(supplies.id, supplyIds))
    : [];
  const foundRecipes = subRecipeIds.length
    ? await tx
        .select({ id: recipes.id, name: recipes.name })
        .from(recipes)
        .where(inArray(recipes.id, subRecipeIds))
    : [];

  const supplyIdSet = new Set(foundSupplies.map((row) => row.id));
  const recipeIdSet = new Set(foundRecipes.map((row) => row.id));
  items.forEach((item, index) => {
    if (item.supplyId !== undefined && !supplyIdSet.has(item.supplyId)) {
      throw itemError(index, 'Insumo não encontrado');
    }
    if (item.recipeId !== undefined && !recipeIdSet.has(item.recipeId)) {
      throw itemError(index, 'Ficha técnica não encontrada');
    }
  });

  if (recipeId === null || subRecipeIds.length === 0) return;

  // Mapa atual de "quem usa quem", sem os itens desta receita (eles serão substituídos).
  const edges = await tx
    .select({ recipeId: recipeItems.recipeId, subRecipeId: recipeItems.subRecipeId })
    .from(recipeItems);
  const subRecipesOf = new Map<number, number[]>();
  for (const edge of edges) {
    if (edge.subRecipeId === null || edge.recipeId === recipeId) continue;
    subRecipesOf.set(edge.recipeId, [...(subRecipesOf.get(edge.recipeId) ?? []), edge.subRecipeId]);
  }

  const culprit = findCycleCulprit(recipeId, subRecipeIds, subRecipesOf);
  if (culprit !== null) {
    const name = foundRecipes.find((row) => row.id === culprit)!.name;
    throw itemError(
      subRecipeIds.indexOf(culprit),
      `"${name}" já usa esta ficha técnica (direta ou indiretamente). Uma não pode usar a outra.`,
    );
  }
}

async function insertItems(tx: Transaction, recipeId: number, items: RecipeItemInput[]) {
  await tx.insert(recipeItems).values(
    items.map((item, position) => ({
      recipeId,
      position,
      supplyId: item.supplyId ?? null,
      subRecipeId: item.recipeId ?? null,
      quantity: item.quantity,
    })),
  );
}

export async function createRecipe(input: RecipeInput, actorUserId: number): Promise<RecipeDetail> {
  const values = {
    name: input.name,
    yieldQuantity: input.yieldQuantity,
    yieldUnit: input.yieldUnit,
    notes: input.notes ?? null,
  };
  const items = normalizeItems(input.items);

  try {
    return await db.transaction(async (tx) => {
      await lockRecipeGraph(tx);
      await validateItems(tx, null, items);

      const [row] = await tx.insert(recipes).values(values).returning();
      await insertItems(tx, row!.id, items);
      await recordAudit(tx, {
        userId: actorUserId,
        entityType: 'recipe',
        entityId: row!.id,
        action: 'create',
        changes: { ...values, items },
      });

      return getRecipe(row!.id, tx);
    });
  } catch (err) {
    rethrowNameTaken(err);
  }
}

export async function updateRecipe(
  id: number,
  changes: RecipeChanges,
  actorUserId: number,
): Promise<RecipeDetail> {
  try {
    return await db.transaction(async (tx) => {
      await lockRecipeGraph(tx);
      const [current] = await tx.select().from(recipes).where(eq(recipes.id, id)).for('update');
      if (!current) throw NOT_FOUND();

      const { items: newItems, ...fieldChanges } = changes;
      const patch: Record<string, unknown> = {};
      const diff: Record<string, { from: unknown; to: unknown }> = {};

      for (const [field, to] of Object.entries(fieldChanges)) {
        if (to === undefined) continue;
        const from = current[field as keyof typeof fieldChanges];
        if (from !== to) {
          patch[field] = to;
          diff[field] = { from, to };
        }
      }

      // Decisão AP: quem usa esta ficha mede em "g", "ml" ou "un" dela; trocar a unidade quebraria as contas.
      if (patch.yieldUnit !== undefined) {
        const [parent] = await tx
          .select({ name: recipes.name })
          .from(recipeItems)
          .innerJoin(recipes, eq(recipeItems.recipeId, recipes.id))
          .where(eq(recipeItems.subRecipeId, id))
          .limit(1);
        if (parent) {
          throw new AppError(
            409,
            'RECIPE_IN_USE',
            `A unidade do rendimento não pode mudar: esta ficha é usada em "${parent.name}".`,
          );
        }

        // Decisão AV: produtos também medem a ficha na unidade do rendimento.
        const [product] = await tx
          .select({ name: products.name })
          .from(products)
          .where(eq(products.recipeId, id))
          .limit(1);
        if (product) {
          throw new AppError(
            409,
            'RECIPE_IN_USE',
            `A unidade do rendimento não pode mudar: esta ficha é usada no produto "${product.name}".`,
          );
        }
      }

      // Decisão AQ: a lista de itens chega sempre completa e substitui a anterior.
      if (newItems !== undefined) {
        const currentRows = await tx
          .select()
          .from(recipeItems)
          .where(eq(recipeItems.recipeId, id))
          .orderBy(asc(recipeItems.position));
        const before = itemsFromRows(currentRows);
        const after = normalizeItems(newItems);

        if (JSON.stringify(before) !== JSON.stringify(after)) {
          await validateItems(tx, id, after);
          await tx.delete(recipeItems).where(eq(recipeItems.recipeId, id));
          await insertItems(tx, id, after);
          diff.items = { from: before, to: after };
        }
      }

      if (Object.keys(diff).length === 0) return getRecipe(id, tx);

      // updated_at muda mesmo quando só os itens mudaram.
      await tx
        .update(recipes)
        .set({ ...patch, updatedAt: new Date() })
        .where(eq(recipes.id, id));
      await recordAudit(tx, {
        userId: actorUserId,
        entityType: 'recipe',
        entityId: id,
        action: 'update',
        changes: diff,
      });

      return getRecipe(id, tx);
    });
  } catch (err) {
    rethrowNameTaken(err);
  }
}
