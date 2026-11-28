import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { users } from './users.js';

/** Decisão AY: dois lugares onde o dinheiro fica — o caixa (dinheiro físico) e a conta (Pix/banco). */
export const financeAccount = pgEnum('finance_account', ['cash', 'bank']);

export const financeEntryKind = pgEnum('finance_entry_kind', ['income', 'expense']);

// Datas sem hora (decisão BA): "dia 28/11" é o mesmo dia em qualquer fuso; lidas como texto "2026-11-28".
const occurredOn = () => date('occurred_on', { mode: 'string' }).notNull();
const createdBy = () =>
  bigint('created_by', { mode: 'number' }).references(() => users.id, { onDelete: 'set null' });
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

/** Categorias de entrada (ex.: Vendas) e de saída (ex.: Insumos, Gás). Arquivadas, nunca excluídas. */
export const financeCategories = pgTable(
  'finance_categories',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    name: text('name').notNull(),
    // Não muda depois de criada: lançamentos antigos dependem dela.
    kind: financeEntryKind('kind').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex('finance_categories_name_lower_unique').on(sql`lower(${table.name})`),
    // Alvo da chave estrangeira composta abaixo: (id, tipo).
    unique('finance_categories_id_kind_unique').on(table.id, table.kind),
  ],
);

/** Entradas e saídas que de fato aconteceram (decisão AZ: sem contas a pagar). */
export const financeTransactions = pgTable(
  'finance_transactions',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    kind: financeEntryKind('kind').notNull(),
    account: financeAccount('account').notNull(),
    categoryId: bigint('category_id', { mode: 'number' }).notNull(),
    // Decisão AD: centavos inteiros, sempre positivo; o tipo diz se soma ou subtrai.
    amountCents: integer('amount_cents').notNull(),
    occurredOn: occurredOn(),
    description: text('description').notNull(),
    createdBy: createdBy(),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('finance_transactions_occurred_on_idx').on(table.occurredOn),
    index('finance_transactions_category_id_idx').on(table.categoryId),
    check('finance_transactions_amount_positive', sql`${table.amountCents} > 0`),
    // Decisão BB: (categoria, tipo) precisa existir junto em finance_categories.
    // O banco garante que uma saída nunca fica numa categoria de entrada.
    foreignKey({
      name: 'finance_transactions_category_kind_fk',
      columns: [table.categoryId, table.kind],
      foreignColumns: [financeCategories.id, financeCategories.kind],
    }).onDelete('restrict'),
  ],
);

/** Dinheiro mudando de lugar (ex.: depositar o caixa no banco). Muda saldos, não é entrada nem saída. */
export const financeTransfers = pgTable(
  'finance_transfers',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    fromAccount: financeAccount('from_account').notNull(),
    toAccount: financeAccount('to_account').notNull(),
    amountCents: integer('amount_cents').notNull(),
    occurredOn: occurredOn(),
    description: text('description'),
    createdBy: createdBy(),
    createdAt: createdAt(),
  },
  (table) => [
    index('finance_transfers_occurred_on_idx').on(table.occurredOn),
    check('finance_transfers_amount_positive', sql`${table.amountCents} > 0`),
    check('finance_transfers_different_accounts', sql`${table.fromAccount} <> ${table.toAccount}`),
  ],
);

/**
 * Ajustes de saldo (decisão BC): saldo inicial e diferenças na conferência do caixa.
 * Valor com sinal (+ ou −). Muda o saldo, mas fica fora dos relatórios.
 */
export const financeAdjustments = pgTable(
  'finance_adjustments',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    account: financeAccount('account').notNull(),
    amountCents: integer('amount_cents').notNull(),
    occurredOn: occurredOn(),
    reason: text('reason').notNull(),
    createdBy: createdBy(),
    createdAt: createdAt(),
  },
  (table) => [
    index('finance_adjustments_occurred_on_idx').on(table.occurredOn),
    check('finance_adjustments_amount_not_zero', sql`${table.amountCents} <> 0`),
  ],
);
