import { api } from '../../lib/api';

export type Account = 'cash' | 'bank';
export type EntryKind = 'income' | 'expense';

export const accountLabels: Record<Account, string> = {
  cash: 'Caixa (dinheiro)',
  bank: 'Conta (Pix/banco)',
};

export const accountShortLabels: Record<Account, string> = { cash: 'Caixa', bank: 'Conta' };

export type FinanceCategory = { id: number; name: string; kind: EntryKind; isActive: boolean };

export type Balances = { cash: number; bank: number; total: number };

/** Um item da lista do mês: entrada, saída, transferência ou ajuste (mesmo formato da API). */
export type Movement =
  | {
      type: EntryKind;
      id: number;
      account: Account;
      category: { id: number; name: string };
      amountCents: number;
      occurredOn: string;
      description: string;
      createdByName: string | null;
    }
  | {
      type: 'transfer';
      id: number;
      fromAccount: Account;
      toAccount: Account;
      amountCents: number;
      occurredOn: string;
      description: string | null;
      createdByName: string | null;
    }
  | {
      type: 'adjustment';
      id: number;
      account: Account;
      /** Com sinal: positivo aumentou o saldo, negativo diminuiu. */
      amountCents: number;
      occurredOn: string;
      description: string;
      createdByName: string | null;
    };

export type MonthMovements = {
  movements: Movement[];
  totals: { incomeCents: number; expenseCents: number; resultCents: number };
};

export type TransactionInput = {
  kind: EntryKind;
  account: Account;
  categoryId: number;
  amountCents: number;
  occurredOn: string;
  description: string;
};

export type Transaction = TransactionInput & { id: number };

/** Tudo do financeiro fica sob "finance": invalidar a raiz atualiza saldos, listas e categorias. */
export const financeKeys = {
  all: ['finance'] as const,
  balances: ['finance', 'balances'] as const,
  movements: (month: string) => ['finance', 'movements', month] as const,
  transaction: (id: number) => ['finance', 'transaction', id] as const,
  categories: (status: 'active' | 'all') => ['finance', 'categories', status] as const,
};

export async function getBalances(): Promise<Balances> {
  return (await api<{ balances: Balances }>('/finance/balances')).balances;
}

export function listMovements(month: string): Promise<MonthMovements> {
  return api<MonthMovements>(`/finance/movements?month=${month}`);
}

export async function listCategories(status: 'active' | 'all'): Promise<FinanceCategory[]> {
  return (await api<{ categories: FinanceCategory[] }>(`/finance/categories?status=${status}`)).categories;
}

export async function createCategory(input: { name: string; kind: EntryKind }): Promise<FinanceCategory> {
  return (await api<{ category: FinanceCategory }>('/finance/categories', { method: 'POST', body: input }))
    .category;
}

export async function updateCategory(
  id: number,
  changes: { name?: string; isActive?: boolean },
): Promise<FinanceCategory> {
  return (
    await api<{ category: FinanceCategory }>(`/finance/categories/${id}`, { method: 'PATCH', body: changes })
  ).category;
}

export async function getTransaction(id: number): Promise<Transaction> {
  return (await api<{ transaction: Transaction }>(`/finance/transactions/${id}`)).transaction;
}

export async function createTransaction(input: TransactionInput): Promise<Transaction> {
  return (await api<{ transaction: Transaction }>('/finance/transactions', { method: 'POST', body: input }))
    .transaction;
}

export async function updateTransaction(
  id: number,
  changes: Partial<TransactionInput>,
): Promise<Transaction> {
  return (
    await api<{ transaction: Transaction }>(`/finance/transactions/${id}`, { method: 'PATCH', body: changes })
  ).transaction;
}

export function deleteMovement(movement: Pick<Movement, 'type' | 'id'>): Promise<void> {
  const path = {
    income: 'transactions',
    expense: 'transactions',
    transfer: 'transfers',
    adjustment: 'adjustments',
  }[movement.type];
  return api<void>(`/finance/${path}/${movement.id}`, { method: 'DELETE' });
}

export function createTransfer(input: {
  fromAccount: Account;
  toAccount: Account;
  amountCents: number;
  occurredOn: string;
  description: string | null;
}): Promise<unknown> {
  return api('/finance/transfers', { method: 'POST', body: input });
}

export function createAdjustment(input: {
  account: Account;
  amountCents: number;
  occurredOn: string;
  reason: string;
}): Promise<unknown> {
  return api('/finance/adjustments', { method: 'POST', body: input });
}
