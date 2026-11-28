// Regras do formulário de ficha técnica, sem React: dá para testar sem montar a tela.
import { parseQuantity, quantityToInput, type MeasurementUnit } from '../../lib/units';
import type { RecipeDetail, RecipeInput, RecipeItemInput } from './recipes-api';

/** Uma linha da ficha como está na tela. `component` é "s:12" (insumo 12), "r:5" (ficha 5) ou "". */
export type ItemRow = { key: number; component: string; quantity: string };

export type RecipeFormValues = {
  name: string;
  yieldQuantity: string;
  yieldUnit: MeasurementUnit;
  notes: string;
  items: ItemRow[];
};

/** O que o formulário precisa saber de cada insumo e ficha para mostrar unidade e custo. */
export type CostSources = {
  supplies: ReadonlyMap<number, { unit: MeasurementUnit; unitCostCents: number }>;
  recipes: ReadonlyMap<number, { yieldUnit: MeasurementUnit; costPerYieldUnitCents: number }>;
};

// Chave estável de cada linha para o React (não pode ser a posição: linhas são removidas do meio).
let nextKey = 0;

export function newItemRow(component = '', quantity = ''): ItemRow {
  return { key: nextKey++, component, quantity };
}

export function componentValue(kind: 'supply' | 'recipe', id: number): string {
  return `${kind === 'supply' ? 's' : 'r'}:${id}`;
}

export function parseComponent(value: string): { kind: 'supply' | 'recipe'; id: number } | null {
  const match = /^([sr]):(\d+)$/.exec(value);
  if (!match) return null;
  return { kind: match[1] === 's' ? 'supply' : 'recipe', id: Number(match[2]) };
}

export function emptyFormValues(): RecipeFormValues {
  return { name: '', yieldQuantity: '', yieldUnit: 'un', notes: '', items: [newItemRow()] };
}

export function valuesFromRecipe(recipe: RecipeDetail): RecipeFormValues {
  return {
    name: recipe.name,
    yieldQuantity: quantityToInput(recipe.yieldQuantity),
    yieldUnit: recipe.yieldUnit,
    notes: recipe.notes ?? '',
    items: recipe.items.map((item) =>
      newItemRow(componentValue(item.kind, item.id), quantityToInput(item.quantity)),
    ),
  };
}

/** Unidade em que a linha é medida: a do insumo, ou a do rendimento da sub-receita (decisão AK). */
export function rowUnit(row: ItemRow, sources: CostSources): MeasurementUnit | null {
  const component = parseComponent(row.component);
  if (!component) return null;
  if (component.kind === 'supply') return sources.supplies.get(component.id)?.unit ?? null;
  return sources.recipes.get(component.id)?.yieldUnit ?? null;
}

/** Custo da linha em centavos com casas decimais, ou null se ainda estiver incompleta. */
export function rowCostCents(row: ItemRow, sources: CostSources): number | null {
  const component = parseComponent(row.component);
  const quantity = parseQuantity(row.quantity);
  if (!component || quantity === null) return null;

  if (component.kind === 'supply') {
    const supply = sources.supplies.get(component.id);
    return supply ? quantity * supply.unitCostCents : null;
  }
  const recipe = sources.recipes.get(component.id);
  return recipe ? quantity * recipe.costPerYieldUnitCents : null;
}

/** Soma das linhas já completas (a prévia aparece enquanto a ficha é preenchida). */
export function previewTotalCents(rows: ItemRow[], sources: CostSources): number {
  return rows.reduce((sum, row) => sum + (rowCostCents(row, sources) ?? 0), 0);
}

/** Confere e converte o formulário. Devolve o que vai para a API, ou a mensagem do primeiro problema. */
export function toRecipeInput(values: RecipeFormValues): { input: RecipeInput } | { error: string } {
  if (!values.name.trim()) return { error: 'Informe o nome.' };

  const yieldQuantity = parseQuantity(values.yieldQuantity);
  if (yieldQuantity === null || yieldQuantity <= 0) {
    return { error: 'Informe quanto a receita rende (ex.: 1 ou 1.200). Use vírgula para decimais.' };
  }

  if (values.items.length === 0) return { error: 'Adicione pelo menos um item.' };

  const items: RecipeItemInput[] = [];
  for (const [index, row] of values.items.entries()) {
    const line = index + 1;
    const component = parseComponent(row.component);
    if (!component) return { error: `Escolha o item da linha ${line}.` };

    const quantity = parseQuantity(row.quantity);
    if (quantity === null || quantity <= 0) {
      return { error: `Quantidade inválida na linha ${line}. Use vírgula para decimais, como em 2,5.` };
    }

    items.push(
      component.kind === 'supply'
        ? { supplyId: component.id, quantity }
        : { recipeId: component.id, quantity },
    );
  }

  return {
    input: {
      name: values.name.trim(),
      yieldQuantity,
      yieldUnit: values.yieldUnit,
      notes: values.notes.trim() || null,
      items,
    },
  };
}
