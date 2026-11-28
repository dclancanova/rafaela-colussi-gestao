import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { recipes } from './recipes.js';

/**
 * Produto = o que se vende (decisão AR): uma ficha técnica e quanto dela vai em cada venda.
 * Ex.: "Cento de brigadeiros" = 100 un da ficha "Brigadeiro".
 */
export const products = pgTable(
  'products',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    name: text('name').notNull(),
    // "restrict": o banco recusa apagar uma ficha que algum produto usa.
    recipeId: bigint('recipe_id', { mode: 'number' })
      .notNull()
      .references(() => recipes.id, { onDelete: 'restrict' }),
    // Na unidade do rendimento da ficha (decisão AK), com até 3 casas (decisão AM).
    recipeQuantity: numeric('recipe_quantity', { precision: 12, scale: 3, mode: 'number' }).notNull(),
    // Decisão AD: centavos inteiros. Digitado pela usuária (o sistema só sugere).
    priceCents: integer('price_cents').notNull(),
    notes: text('notes'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex('products_name_lower_unique').on(sql`lower(${table.name})`),
    index('products_recipe_id_idx').on(table.recipeId),
    check('products_recipe_quantity_positive', sql`${table.recipeQuantity} > 0`),
    check('products_price_non_negative', sql`${table.priceCents} >= 0`),
  ],
);

/**
 * Configuração de preços (decisão AT): uma linha só, com id fixo 1.
 * É a exceção à decisão N (ids gerados): aqui nunca existe uma segunda linha.
 */
export const pricingSettings = pgTable(
  'pricing_settings',
  {
    id: integer('id').primaryKey().default(1),
    // Decisão AS: pontos-base (2000 = 20%).
    indirectCostBasisPoints: integer('indirect_cost_basis_points').notNull().default(0),
    targetMarginBasisPoints: integer('target_margin_basis_points').notNull().default(6000),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    check('pricing_settings_single_row', sql`${table.id} = 1`),
    check('pricing_settings_indirect_range', sql`${table.indirectCostBasisPoints} between 0 and 50000`),
    // 100% de margem exigiria preço infinito; 95% já é um teto generoso.
    check('pricing_settings_target_margin_range', sql`${table.targetMarginBasisPoints} between 0 and 9500`),
  ],
);
