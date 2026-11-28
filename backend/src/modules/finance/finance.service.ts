import { and, eq, gte, lt, sql, type AnyColumn } from 'drizzle-orm';
import { db, type Transaction } from '../../database/client.js';
import {
  financeAccount,
  financeAdjustments,
  financeCategories,
  financeTransactions,
  financeTransfers,
  users,
} from '../../database/schema/index.js';
import { recordAudit } from '../../shared/audit.js';
import { monthRange } from '../../shared/dates.js';
import { NotFoundError, ValidationError } from '../../shared/errors.js';
import type { EntryKind } from './categories.service.js';

export const ACCOUNTS = financeAccount.enumValues;
export type Account = (typeof ACCOUNTS)[number];

export type TransactionInput = {
  kind: EntryKind;
  account: Account;
  categoryId: number;
  amountCents: number;
  occurredOn: string;
  description: string;
};

export type TransferInput = {
  fromAccount: Account;
  toAccount: Account;
  amountCents: number;
  occurredOn: string;
  description?: string | null;
};

export type AdjustmentInput = { account: Account; amountCents: number; occurredOn: string; reason: string };

type TransactionRow = typeof financeTransactions.$inferSelect;

/** Soma de uma coluna; o Postgres devolve somas como texto, o mapWith converte para número. */
const sumOf = (column: AnyColumn) => sql<number>`coalesce(sum(${column}), 0)`.mapWith(Number);

/**
 * Saldo de cada conta desde o início (decisão BC):
 * entradas − saídas + transferências recebidas − enviadas + ajustes.
 */
export async function getBalances(): Promise<Record<Account, number> & { total: number }> {
  const balance: Record<Account, number> = { cash: 0, bank: 0 };

  const entries = await db
    .select({
      account: financeTransactions.account,
      kind: financeTransactions.kind,
      total: sumOf(financeTransactions.amountCents),
    })
    .from(financeTransactions)
    .groupBy(financeTransactions.account, financeTransactions.kind);
  for (const row of entries) balance[row.account] += row.kind === 'income' ? row.total : -row.total;

  const sent = await db
    .select({ account: financeTransfers.fromAccount, total: sumOf(financeTransfers.amountCents) })
    .from(financeTransfers)
    .groupBy(financeTransfers.fromAccount);
  for (const row of sent) balance[row.account] -= row.total;

  const received = await db
    .select({ account: financeTransfers.toAccount, total: sumOf(financeTransfers.amountCents) })
    .from(financeTransfers)
    .groupBy(financeTransfers.toAccount);
  for (const row of received) balance[row.account] += row.total;

  const adjustments = await db
    .select({ account: financeAdjustments.account, total: sumOf(financeAdjustments.amountCents) })
    .from(financeAdjustments)
    .groupBy(financeAdjustments.account);
  for (const row of adjustments) balance[row.account] += row.total;

  return { ...balance, total: balance.cash + balance.bank };
}

/** Tudo o que aconteceu no mês, numa lista só, do mais recente para o mais antigo. */
export async function listMovements(month: string) {
  const { start, end } = monthRange(month);
  const inMonth = (column: AnyColumn) => and(gte(column, start), lt(column, end));

  const entries = await db
    .select({
      id: financeTransactions.id,
      kind: financeTransactions.kind,
      account: financeTransactions.account,
      categoryId: financeCategories.id,
      categoryName: financeCategories.name,
      amountCents: financeTransactions.amountCents,
      occurredOn: financeTransactions.occurredOn,
      description: financeTransactions.description,
      createdByName: users.name,
      createdAt: financeTransactions.createdAt,
    })
    .from(financeTransactions)
    .innerJoin(financeCategories, eq(financeTransactions.categoryId, financeCategories.id))
    .leftJoin(users, eq(financeTransactions.createdBy, users.id))
    .where(inMonth(financeTransactions.occurredOn));

  const transfers = await db
    .select({
      id: financeTransfers.id,
      fromAccount: financeTransfers.fromAccount,
      toAccount: financeTransfers.toAccount,
      amountCents: financeTransfers.amountCents,
      occurredOn: financeTransfers.occurredOn,
      description: financeTransfers.description,
      createdByName: users.name,
      createdAt: financeTransfers.createdAt,
    })
    .from(financeTransfers)
    .leftJoin(users, eq(financeTransfers.createdBy, users.id))
    .where(inMonth(financeTransfers.occurredOn));

  const adjustments = await db
    .select({
      id: financeAdjustments.id,
      account: financeAdjustments.account,
      amountCents: financeAdjustments.amountCents,
      occurredOn: financeAdjustments.occurredOn,
      reason: financeAdjustments.reason,
      createdByName: users.name,
      createdAt: financeAdjustments.createdAt,
    })
    .from(financeAdjustments)
    .leftJoin(users, eq(financeAdjustments.createdBy, users.id))
    .where(inMonth(financeAdjustments.occurredOn));

  const movements = [
    ...entries.map(({ kind, categoryId, categoryName, ...row }) => ({
      ...row,
      type: kind,
      category: { id: categoryId, name: categoryName },
    })),
    ...transfers.map((row) => ({ ...row, type: 'transfer' as const })),
    ...adjustments.map(({ reason, ...row }) => ({
      ...row,
      type: 'adjustment' as const,
      description: reason,
    })),
  ].sort((a, b) => b.occurredOn.localeCompare(a.occurredOn) || b.createdAt.getTime() - a.createdAt.getTime());

  // Totais do mês: só entradas e saídas. Transferências e ajustes não são faturamento nem despesa.
  const incomeCents = entries
    .filter((row) => row.kind === 'income')
    .reduce((sum, row) => sum + row.amountCents, 0);
  const expenseCents = entries
    .filter((row) => row.kind === 'expense')
    .reduce((sum, row) => sum + row.amountCents, 0);

  return {
    movements: movements.map(({ createdAt: _createdAt, ...movement }) => movement),
    totals: { incomeCents, expenseCents, resultCents: incomeCents - expenseCents },
  };
}

function toTransactionDto(row: TransactionRow) {
  return {
    id: row.id,
    kind: row.kind,
    account: row.account,
    categoryId: row.categoryId,
    amountCents: row.amountCents,
    occurredOn: row.occurredOn,
    description: row.description,
  };
}

export type TransactionDto = ReturnType<typeof toTransactionDto>;

const TRANSACTION_NOT_FOUND = () => new NotFoundError('Lançamento não encontrado');

function categoryError(message: string): ValidationError {
  return new ValidationError(message, [{ field: 'categoryId', message }]);
}

/**
 * A categoria precisa existir e ser do mesmo tipo do lançamento (o banco também garante isso, decisão BB;
 * aqui é para a mensagem ser clara). Arquivada só vale se o lançamento já estava nela.
 */
async function assertUsableCategory(
  tx: Transaction,
  categoryId: number,
  kind: EntryKind,
  allowArchived: boolean,
) {
  const [category] = await tx.select().from(financeCategories).where(eq(financeCategories.id, categoryId));
  if (!category) throw categoryError('Categoria não encontrada');
  if (category.kind !== kind) {
    throw categoryError(
      kind === 'income' ? 'Escolha uma categoria de entrada' : 'Escolha uma categoria de saída',
    );
  }
  if (!category.isActive && !allowArchived) throw categoryError('Esta categoria está arquivada');
}

export async function getTransaction(id: number): Promise<TransactionDto> {
  const [row] = await db.select().from(financeTransactions).where(eq(financeTransactions.id, id));
  if (!row) throw TRANSACTION_NOT_FOUND();
  return toTransactionDto(row);
}

export async function createTransaction(
  input: TransactionInput,
  actorUserId: number,
): Promise<TransactionDto> {
  return db.transaction(async (tx) => {
    await assertUsableCategory(tx, input.categoryId, input.kind, false);
    const [row] = await tx
      .insert(financeTransactions)
      .values({ ...input, createdBy: actorUserId })
      .returning();
    await recordAudit(tx, {
      userId: actorUserId,
      entityType: 'finance_transaction',
      entityId: row!.id,
      action: 'create',
      changes: input,
    });
    return toTransactionDto(row!);
  });
}

export async function updateTransaction(
  id: number,
  changes: Partial<TransactionInput>,
  actorUserId: number,
): Promise<TransactionDto> {
  return db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(financeTransactions)
      .where(eq(financeTransactions.id, id))
      .for('update');
    if (!current) throw TRANSACTION_NOT_FOUND();

    const patch: Record<string, unknown> = {};
    const diff: Record<string, { from: unknown; to: unknown }> = {};
    for (const [field, to] of Object.entries(changes)) {
      if (to === undefined) continue;
      const from = current[field as keyof TransactionInput];
      if (from !== to) {
        patch[field] = to;
        diff[field] = { from, to };
      }
    }
    if (Object.keys(patch).length === 0) return toTransactionDto(current);

    // Mudou o tipo ou a categoria: confere a combinação final.
    if (patch.kind !== undefined || patch.categoryId !== undefined) {
      const kind = (patch.kind as EntryKind | undefined) ?? current.kind;
      const categoryId = (patch.categoryId as number | undefined) ?? current.categoryId;
      await assertUsableCategory(tx, categoryId, kind, categoryId === current.categoryId);
    }

    const [updated] = await tx
      .update(financeTransactions)
      .set(patch)
      .where(eq(financeTransactions.id, id))
      .returning();
    await recordAudit(tx, {
      userId: actorUserId,
      entityType: 'finance_transaction',
      entityId: id,
      action: 'update',
      changes: diff,
    });
    return toTransactionDto(updated!);
  });
}

/**
 * Exclusão de verdade (decisão BE): lançamento errado é apagado, não arquivado.
 * A auditoria guarda o registro inteiro, então nada se perde.
 */
export async function deleteTransaction(id: number, actorUserId: number): Promise<void> {
  await db.transaction(async (tx) => {
    const [deleted] = await tx.delete(financeTransactions).where(eq(financeTransactions.id, id)).returning();
    if (!deleted) throw TRANSACTION_NOT_FOUND();
    await recordAudit(tx, {
      userId: actorUserId,
      entityType: 'finance_transaction',
      entityId: id,
      action: 'delete',
      changes: toTransactionDto(deleted),
    });
  });
}

export async function createTransfer(input: TransferInput, actorUserId: number) {
  return db.transaction(async (tx) => {
    const values = { ...input, description: input.description ?? null, createdBy: actorUserId };
    const [row] = await tx.insert(financeTransfers).values(values).returning();
    await recordAudit(tx, {
      userId: actorUserId,
      entityType: 'finance_transfer',
      entityId: row!.id,
      action: 'create',
      changes: input,
    });
    return { id: row!.id };
  });
}

export async function deleteTransfer(id: number, actorUserId: number): Promise<void> {
  await db.transaction(async (tx) => {
    const [deleted] = await tx.delete(financeTransfers).where(eq(financeTransfers.id, id)).returning();
    if (!deleted) throw new NotFoundError('Transferência não encontrada');
    const { createdBy: _createdBy, createdAt: _createdAt, ...record } = deleted;
    await recordAudit(tx, {
      userId: actorUserId,
      entityType: 'finance_transfer',
      entityId: id,
      action: 'delete',
      changes: record,
    });
  });
}

export async function createAdjustment(input: AdjustmentInput, actorUserId: number) {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(financeAdjustments)
      .values({ ...input, createdBy: actorUserId })
      .returning();
    await recordAudit(tx, {
      userId: actorUserId,
      entityType: 'finance_adjustment',
      entityId: row!.id,
      action: 'create',
      changes: input,
    });
    return { id: row!.id };
  });
}

export async function deleteAdjustment(id: number, actorUserId: number): Promise<void> {
  await db.transaction(async (tx) => {
    const [deleted] = await tx.delete(financeAdjustments).where(eq(financeAdjustments.id, id)).returning();
    if (!deleted) throw new NotFoundError('Ajuste não encontrado');
    const { createdBy: _createdBy, createdAt: _createdAt, ...record } = deleted;
    await recordAudit(tx, {
      userId: actorUserId,
      entityType: 'finance_adjustment',
      entityId: id,
      action: 'delete',
      changes: record,
    });
  });
}
