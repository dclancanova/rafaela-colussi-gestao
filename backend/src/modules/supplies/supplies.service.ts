import { and, asc, eq, type SQL } from 'drizzle-orm';
import { db } from '../../database/client.js';
import { lockRecipeGraph } from '../../database/locks.js';
import { measurementUnit, recipeItems, recipes, supplies, supplyKind } from '../../database/schema/index.js';
import { recordAudit } from '../../shared/audit.js';
import { isUniqueViolation } from '../../shared/database-errors.js';
import { AppError, NotFoundError } from '../../shared/errors.js';
import { unitCostCents } from './supply-cost.js';

export const SUPPLY_KINDS = supplyKind.enumValues;
export const MEASUREMENT_UNITS = measurementUnit.enumValues;

export type SupplyKind = (typeof SUPPLY_KINDS)[number];
export type MeasurementUnit = (typeof MEASUREMENT_UNITS)[number];
export type SupplyStatusFilter = 'active' | 'archived' | 'all';

export type SupplyInput = {
  name: string;
  kind: SupplyKind;
  unit: MeasurementUnit;
  packageQuantity: number;
  packagePriceCents: number;
  notes?: string | null;
};

/** Só os campos enviados são alterados. */
export type SupplyChanges = Partial<SupplyInput & { isActive: boolean }>;

type SupplyRow = typeof supplies.$inferSelect;

const NAME_TAKEN = () => new AppError(409, 'SUPPLY_NAME_TAKEN', 'Já existe um insumo com este nome');
const NOT_FOUND = () => new NotFoundError('Insumo não encontrado');

/** O que a API devolve: os dados do banco mais o custo por unidade-base, já calculado. */
function toSupplyDto(row: SupplyRow) {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    unit: row.unit,
    packageQuantity: row.packageQuantity,
    packagePriceCents: row.packagePriceCents,
    unitCostCents: unitCostCents(row.packagePriceCents, row.packageQuantity),
    notes: row.notes,
    isActive: row.isActive,
    updatedAt: row.updatedAt,
  };
}

export type SupplyDto = ReturnType<typeof toSupplyDto>;

/** Nome repetido vira 409 com mensagem clara; qualquer outro erro segue adiante. */
function rethrowNameTaken(err: unknown): never {
  if (isUniqueViolation(err, 'supplies_name_lower_unique')) throw NAME_TAKEN();
  throw err;
}

export async function listSupplies(filter: {
  kind?: SupplyKind;
  status: SupplyStatusFilter;
}): Promise<SupplyDto[]> {
  const conditions: SQL[] = [];
  if (filter.kind) conditions.push(eq(supplies.kind, filter.kind));
  if (filter.status !== 'all') conditions.push(eq(supplies.isActive, filter.status === 'active'));

  const rows = await db
    .select()
    .from(supplies)
    .where(and(...conditions))
    .orderBy(asc(supplies.name));

  return rows.map(toSupplyDto);
}

export async function getSupply(id: number): Promise<SupplyDto> {
  const [row] = await db.select().from(supplies).where(eq(supplies.id, id)).limit(1);
  if (!row) throw NOT_FOUND();
  return toSupplyDto(row);
}

export async function createSupply(input: SupplyInput, actorUserId: number): Promise<SupplyDto> {
  const values = { ...input, notes: input.notes ?? null };

  try {
    return await db.transaction(async (tx) => {
      const [row] = await tx.insert(supplies).values(values).returning();
      // Decisão AI: auditoria na mesma transação.
      await recordAudit(tx, {
        userId: actorUserId,
        entityType: 'supply',
        entityId: row!.id,
        action: 'create',
        changes: values,
      });
      return toSupplyDto(row!);
    });
  } catch (err) {
    rethrowNameTaken(err);
  }
}

export async function updateSupply(
  id: number,
  changes: SupplyChanges,
  actorUserId: number,
): Promise<SupplyDto> {
  try {
    return await db.transaction(async (tx) => {
      // Trocar a unidade depende de o insumo estar ou não em fichas técnicas: trava o "mapa" de fichas
      // ANTES da linha do insumo, na mesma ordem que as fichas usam (ordens diferentes = deadlock).
      if (changes.unit !== undefined) await lockRecipeGraph(tx);

      // "for update" trava a linha até o fim da transação: duas edições ao mesmo tempo
      // não leem o mesmo "antes" e a auditoria fica correta.
      const [current] = await tx.select().from(supplies).where(eq(supplies.id, id)).for('update');
      if (!current) throw NOT_FOUND();

      // Decisão AI: guarda só o que mudou de verdade, como { campo: { from, to } }.
      const patch: Record<string, unknown> = {};
      const diff: Record<string, { from: unknown; to: unknown }> = {};
      for (const [field, to] of Object.entries(changes)) {
        if (to === undefined) continue;
        const from = current[field as keyof SupplyChanges];
        if (from !== to) {
          patch[field] = to;
          diff[field] = { from, to };
        }
      }

      // Nada mudou: não grava nem audita.
      if (Object.keys(patch).length === 0) return toSupplyDto(current);

      // Decisão AP: as fichas medem este insumo na unidade atual; 300 g não podem virar 300 un.
      if (patch.unit !== undefined) {
        const [usage] = await tx
          .select({ recipeName: recipes.name })
          .from(recipeItems)
          .innerJoin(recipes, eq(recipeItems.recipeId, recipes.id))
          .where(eq(recipeItems.supplyId, id))
          .limit(1);
        if (usage) {
          throw new AppError(
            409,
            'SUPPLY_IN_USE',
            `A unidade não pode mudar: este insumo é usado na ficha técnica "${usage.recipeName}".`,
          );
        }
      }

      const [updated] = await tx.update(supplies).set(patch).where(eq(supplies.id, id)).returning();
      await recordAudit(tx, {
        userId: actorUserId,
        entityType: 'supply',
        entityId: id,
        action: 'update',
        changes: diff,
      });
      return toSupplyDto(updated!);
    });
  } catch (err) {
    rethrowNameTaken(err);
  }
}
