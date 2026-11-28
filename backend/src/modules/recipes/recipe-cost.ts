import { unitCostCents } from '../supplies/supply-cost.js';

export type CostSupply = { packagePriceCents: number; packageQuantity: number };

export type CostItem = { supplyId: number | null; subRecipeId: number | null; quantity: number };

export type CostRecipe = { yieldQuantity: number; items: CostItem[] };

/**
 * Calcula custos de fichas técnicas a partir dos preços atuais (decisão AO: nunca guardado).
 *
 * Tudo em centavos COM casas decimais (decisão AF): quem mostra o total arredonda uma vez, no fim.
 * Cada receita é calculada uma vez só e lembrada ("memo"): se o recheio entra em 10 bolos,
 * a conta do recheio não é refeita 10 vezes.
 */
export function createRecipeCostCalculator(
  supplies: ReadonlyMap<number, CostSupply>,
  recipes: ReadonlyMap<number, CostRecipe>,
) {
  const totals = new Map<number, number>();
  // Receitas "em cálculo" agora: reencontrar uma delas significa ciclo (A usa B que usa A).
  const inProgress = new Set<number>();

  function itemCostCents(item: CostItem): number {
    if (item.supplyId !== null) {
      const supply = supplies.get(item.supplyId);
      if (!supply) throw new Error(`Insumo ${item.supplyId} não encontrado`);
      return item.quantity * unitCostCents(supply.packagePriceCents, supply.packageQuantity);
    }
    if (item.subRecipeId !== null) {
      return item.quantity * costPerYieldUnitCents(item.subRecipeId);
    }
    throw new Error('Item sem insumo nem receita');
  }

  function totalCostCents(recipeId: number): number {
    const known = totals.get(recipeId);
    if (known !== undefined) return known;

    const recipe = recipes.get(recipeId);
    if (!recipe) throw new Error(`Receita ${recipeId} não encontrada`);
    // O banco e o service impedem ciclos; isto só garante que um bug não vire laço infinito.
    if (inProgress.has(recipeId)) throw new Error(`Ciclo de sub-receitas na receita ${recipeId}`);

    inProgress.add(recipeId);
    const total = recipe.items.reduce((sum, item) => sum + itemCostCents(item), 0);
    inProgress.delete(recipeId);

    totals.set(recipeId, total);
    return total;
  }

  /** Custo de 1 unidade do rendimento (1 g, 1 ml ou 1 un da receita pronta). */
  function costPerYieldUnitCents(recipeId: number): number {
    const recipe = recipes.get(recipeId);
    if (!recipe) throw new Error(`Receita ${recipeId} não encontrada`);
    return totalCostCents(recipeId) / recipe.yieldQuantity;
  }

  return { itemCostCents, totalCostCents, costPerYieldUnitCents };
}

/**
 * Diz se fazer `recipeId` usar estas sub-receitas criaria um ciclo, e devolve a primeira culpada.
 * Há ciclo quando alguma delas já usa `recipeId`, direta ou indiretamente.
 *
 * `subRecipesOf` é o "mapa" atual: para cada receita, as sub-receitas que ela usa.
 */
export function findCycleCulprit(
  recipeId: number,
  newSubRecipeIds: readonly number[],
  subRecipesOf: ReadonlyMap<number, readonly number[]>,
): number | null {
  for (const candidate of newSubRecipeIds) {
    if (reaches(candidate, recipeId, subRecipesOf)) return candidate;
  }
  return null;
}

/** Busca em largura: partindo de `from`, seguindo "usa a sub-receita", chega em `target`? */
function reaches(
  from: number,
  target: number,
  subRecipesOf: ReadonlyMap<number, readonly number[]>,
): boolean {
  const queue = [from];
  const seen = new Set<number>();

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === target) return true;
    if (seen.has(current)) continue;
    seen.add(current);
    queue.push(...(subRecipesOf.get(current) ?? []));
  }
  return false;
}
