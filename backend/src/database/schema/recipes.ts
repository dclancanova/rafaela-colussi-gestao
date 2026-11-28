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
import { measurementUnit, supplies } from './supplies.js';

// Decisão AM: quantidades com até 3 casas (ex.: 2,5 g de fermento; 0,5 un de massa).
// Não é dinheiro, então "number" no JavaScript é aceitável aqui.
const quantity = (name: string) => numeric(name, { precision: 12, scale: 3, mode: 'number' });

/** Ficha técnica: uma receita com rendimento, usada como produto ou como sub-receita de outras. */
export const recipes = pgTable(
  'recipes',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    name: text('name').notNull(),
    // Decisão AK: quanto a receita rende, na unidade-base (ex.: 1200 g de recheio, 1 un de bolo).
    yieldQuantity: quantity('yield_quantity').notNull(),
    yieldUnit: measurementUnit('yield_unit').notNull(),
    notes: text('notes'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex('recipes_name_lower_unique').on(sql`lower(${table.name})`),
    check('recipes_yield_quantity_positive', sql`${table.yieldQuantity} > 0`),
  ],
);

/** Cada linha da ficha técnica: um insumo OU uma sub-receita, com a quantidade usada. */
export const recipeItems = pgTable(
  'recipe_items',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    // Apagar a receita apaga as linhas dela (receitas são arquivadas, mas o banco fica coerente).
    recipeId: bigint('recipe_id', { mode: 'number' })
      .notNull()
      .references(() => recipes.id, { onDelete: 'cascade' }),
    // Ordem em que as linhas aparecem na ficha.
    position: integer('position').notNull(),
    // "restrict": o banco recusa apagar um insumo ou receita que alguma ficha usa.
    supplyId: bigint('supply_id', { mode: 'number' }).references(() => supplies.id, {
      onDelete: 'restrict',
    }),
    subRecipeId: bigint('sub_recipe_id', { mode: 'number' }).references(() => recipes.id, {
      onDelete: 'restrict',
    }),
    // Na unidade do insumo, ou na unidade do rendimento da sub-receita.
    quantity: quantity('quantity').notNull(),
  },
  (table) => [
    index('recipe_items_recipe_id_idx').on(table.recipeId),
    index('recipe_items_supply_id_idx').on(table.supplyId),
    index('recipe_items_sub_recipe_id_idx').on(table.subRecipeId),
    // Decisão AL: exatamente um dos dois preenchido.
    check(
      'recipe_items_exactly_one_component',
      sql`num_nonnulls(${table.supplyId}, ${table.subRecipeId}) = 1`,
    ),
    check('recipe_items_not_itself', sql`${table.subRecipeId} <> ${table.recipeId}`),
    check('recipe_items_quantity_positive', sql`${table.quantity} > 0`),
    // O mesmo componente não aparece duas vezes na mesma ficha.
    uniqueIndex('recipe_items_recipe_supply_unique').on(table.recipeId, table.supplyId),
    uniqueIndex('recipe_items_recipe_sub_recipe_unique').on(table.recipeId, table.subRecipeId),
  ],
);
