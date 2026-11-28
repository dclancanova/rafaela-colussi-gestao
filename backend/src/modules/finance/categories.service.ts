import { and, asc, eq, type SQL } from 'drizzle-orm';
import { db } from '../../database/client.js';
import { financeCategories, financeEntryKind } from '../../database/schema/index.js';
import { recordAudit } from '../../shared/audit.js';
import { isUniqueViolation } from '../../shared/database-errors.js';
import { AppError, NotFoundError } from '../../shared/errors.js';

export const ENTRY_KINDS = financeEntryKind.enumValues;
export type EntryKind = (typeof ENTRY_KINDS)[number];

type CategoryRow = typeof financeCategories.$inferSelect;

const NAME_TAKEN = () =>
  new AppError(409, 'FINANCE_CATEGORY_NAME_TAKEN', 'Já existe uma categoria com este nome');
const NOT_FOUND = () => new NotFoundError('Categoria não encontrada');

function rethrowNameTaken(err: unknown): never {
  if (isUniqueViolation(err, 'finance_categories_name_lower_unique')) throw NAME_TAKEN();
  throw err;
}

function toCategoryDto(row: CategoryRow) {
  return { id: row.id, name: row.name, kind: row.kind, isActive: row.isActive };
}

export type CategoryDto = ReturnType<typeof toCategoryDto>;

export async function listCategories(filter: {
  kind?: EntryKind;
  status: 'active' | 'archived' | 'all';
}): Promise<CategoryDto[]> {
  const conditions: SQL[] = [];
  if (filter.kind) conditions.push(eq(financeCategories.kind, filter.kind));
  if (filter.status !== 'all') conditions.push(eq(financeCategories.isActive, filter.status === 'active'));

  const rows = await db
    .select()
    .from(financeCategories)
    .where(and(...conditions))
    .orderBy(asc(financeCategories.name));
  return rows.map(toCategoryDto);
}

export async function createCategory(input: { name: string; kind: EntryKind }, actorUserId: number) {
  try {
    return await db.transaction(async (tx) => {
      const [row] = await tx.insert(financeCategories).values(input).returning();
      await recordAudit(tx, {
        userId: actorUserId,
        entityType: 'finance_category',
        entityId: row!.id,
        action: 'create',
        changes: input,
      });
      return toCategoryDto(row!);
    });
  } catch (err) {
    rethrowNameTaken(err);
  }
}

/** Renomeia ou arquiva/reativa. O tipo (entrada/saída) não muda: lançamentos antigos dependem dele. */
export async function updateCategory(
  id: number,
  changes: { name?: string; isActive?: boolean },
  actorUserId: number,
) {
  try {
    return await db.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(financeCategories)
        .where(eq(financeCategories.id, id))
        .for('update');
      if (!current) throw NOT_FOUND();

      const patch: Record<string, unknown> = {};
      const diff: Record<string, { from: unknown; to: unknown }> = {};
      for (const [field, to] of Object.entries(changes)) {
        if (to === undefined) continue;
        const from = current[field as keyof typeof changes];
        if (from !== to) {
          patch[field] = to;
          diff[field] = { from, to };
        }
      }
      if (Object.keys(patch).length === 0) return toCategoryDto(current);

      const [updated] = await tx
        .update(financeCategories)
        .set(patch)
        .where(eq(financeCategories.id, id))
        .returning();
      await recordAudit(tx, {
        userId: actorUserId,
        entityType: 'finance_category',
        entityId: id,
        action: 'update',
        changes: diff,
      });
      return toCategoryDto(updated!);
    });
  } catch (err) {
    rethrowNameTaken(err);
  }
}
