import { api } from '../../lib/api';
import type { MeasurementUnit } from '../../lib/units';

export type RecipeStatus = 'active' | 'archived' | 'all';

/** Mesmo formato que o backend devolve em /recipes. */
export type RecipeSummary = {
  id: number;
  name: string;
  yieldQuantity: number;
  yieldUnit: MeasurementUnit;
  notes: string | null;
  isActive: boolean;
  updatedAt: string;
  itemCount: number;
  /** Já arredondado em centavos (decisão AF). */
  totalCostCents: number;
  /** Custo de 1 g, 1 ml ou 1 un do que a receita rende, com casas decimais. */
  costPerYieldUnitCents: number;
};

export type RecipeItem = {
  kind: 'supply' | 'recipe';
  /** Id do insumo ou da ficha usada. */
  id: number;
  name: string;
  unit: MeasurementUnit;
  isActive: boolean;
  quantity: number;
  costCents: number;
};

export type RecipeDetail = RecipeSummary & {
  items: RecipeItem[];
  /** Fichas que usam esta como sub-receita. */
  usedIn: { id: number; name: string }[];
};

export type RecipeItemInput = { supplyId: number; quantity: number } | { recipeId: number; quantity: number };

export type RecipeInput = {
  name: string;
  yieldQuantity: number;
  yieldUnit: MeasurementUnit;
  notes: string | null;
  items: RecipeItemInput[];
};

export const recipesKeys = {
  all: ['recipes'] as const,
  list: (status: RecipeStatus) => ['recipes', 'list', status] as const,
  detail: (id: number) => ['recipes', 'detail', id] as const,
};

export async function listRecipes(status: RecipeStatus): Promise<RecipeSummary[]> {
  const { recipes } = await api<{ recipes: RecipeSummary[] }>(`/recipes?status=${status}`);
  return recipes;
}

export async function getRecipe(id: number): Promise<RecipeDetail> {
  const { recipe } = await api<{ recipe: RecipeDetail }>(`/recipes/${id}`);
  return recipe;
}

export async function createRecipe(input: RecipeInput): Promise<RecipeDetail> {
  const { recipe } = await api<{ recipe: RecipeDetail }>('/recipes', { method: 'POST', body: input });
  return recipe;
}

export async function updateRecipe(
  id: number,
  changes: Partial<RecipeInput & { isActive: boolean }>,
): Promise<RecipeDetail> {
  const { recipe } = await api<{ recipe: RecipeDetail }>(`/recipes/${id}`, {
    method: 'PATCH',
    body: changes,
  });
  return recipe;
}
