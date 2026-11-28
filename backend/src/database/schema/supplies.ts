import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

// Decisão A: ingredientes e embalagens na mesma tabela.
export const supplyKind = pgEnum('supply_kind', ['ingredient', 'packaging']);

// Decisão F: unidades-base, sem conversões.
export const measurementUnit = pgEnum('measurement_unit', ['g', 'ml', 'un']);

export const supplies = pgTable(
  'supplies',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    name: text('name').notNull(),
    kind: supplyKind('kind').notNull(),
    unit: measurementUnit('unit').notNull(),
    // Decisão AE: a embalagem como foi comprada (ex.: 1000 g por 650 centavos).
    packageQuantity: integer('package_quantity').notNull(),
    // Decisão AD: dinheiro sempre em centavos inteiros.
    packagePriceCents: integer('package_price_cents').notNull(),
    notes: text('notes'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    // Decisão AH: "Farinha" e "farinha" contam como o mesmo nome.
    uniqueIndex('supplies_name_lower_unique').on(sql`lower(${table.name})`),
    check('supplies_package_quantity_positive', sql`${table.packageQuantity} > 0`),
    check('supplies_package_price_non_negative', sql`${table.packagePriceCents} >= 0`),
  ],
);
