import { describe, expect, it } from 'vitest';
import {
  newItemRow,
  parseComponent,
  previewTotalCents,
  rowCostCents,
  rowUnit,
  toRecipeInput,
  type CostSources,
  type RecipeFormValues,
} from './recipe-form';

const sources: CostSources = {
  // Insumo 1: chocolate a 4 centavos/g; insumo 2: caixa a 250 centavos/un
  supplies: new Map([
    [1, { unit: 'g', unitCostCents: 4 }],
    [2, { unit: 'un', unitCostCents: 250 }],
  ]),
  // Ficha 10: recheio a 2,38 centavos/g
  recipes: new Map([[10, { yieldUnit: 'g', costPerYieldUnitCents: 2.38 }]]),
};

function values(overrides: Partial<RecipeFormValues> = {}): RecipeFormValues {
  return {
    name: 'Bolo',
    yieldQuantity: '1',
    yieldUnit: 'un',
    notes: '',
    items: [newItemRow('r:10', '250'), newItemRow('s:2', '1')],
    ...overrides,
  };
}

describe('parseComponent', () => {
  it('lê insumo e ficha, e recusa o resto', () => {
    expect(parseComponent('s:12')).toEqual({ kind: 'supply', id: 12 });
    expect(parseComponent('r:5')).toEqual({ kind: 'recipe', id: 5 });
    expect(parseComponent('')).toBeNull();
    expect(parseComponent('x:1')).toBeNull();
  });
});

describe('unidade e custo das linhas', () => {
  it('usa a unidade do insumo, ou a do rendimento da sub-receita', () => {
    expect(rowUnit(newItemRow('s:2'), sources)).toBe('un');
    expect(rowUnit(newItemRow('r:10'), sources)).toBe('g');
    expect(rowUnit(newItemRow(''), sources)).toBeNull();
  });

  it('calcula o custo da linha com decimais, e null se incompleta', () => {
    expect(rowCostCents(newItemRow('s:1', '2,5'), sources)).toBe(10);
    expect(rowCostCents(newItemRow('r:10', '250'), sources)).toBeCloseTo(595);
    expect(rowCostCents(newItemRow('s:1', ''), sources)).toBeNull();
    expect(rowCostCents(newItemRow('', '10'), sources)).toBeNull();
  });

  it('soma só as linhas completas na prévia', () => {
    const rows = [newItemRow('r:10', '250'), newItemRow('s:2', '1'), newItemRow('', '')];
    expect(previewTotalCents(rows, sources)).toBeCloseTo(845);
  });
});

describe('toRecipeInput', () => {
  it('converte o formulário para a API', () => {
    const result = toRecipeInput(values({ name: '  Bolo  ', yieldQuantity: '1,5', notes: '  ' }));

    expect(result).toEqual({
      input: {
        name: 'Bolo',
        yieldQuantity: 1.5,
        yieldUnit: 'un',
        notes: null,
        items: [
          { recipeId: 10, quantity: 250 },
          { supplyId: 2, quantity: 1 },
        ],
      },
    });
  });

  it.each([
    ['sem nome', { name: ' ' }, /nome/],
    ['rendimento vazio', { yieldQuantity: '' }, /rende/],
    ['rendimento zero', { yieldQuantity: '0' }, /rende/],
    ['sem itens', { items: [] }, /pelo menos um item/],
    ['linha sem item', { items: [newItemRow('s:1', '1'), newItemRow('', '1')] }, /linha 2/],
    ['quantidade com ponto decimal', { items: [newItemRow('s:1', '2.5')] }, /linha 1/],
    ['quantidade zero', { items: [newItemRow('s:1', '0')] }, /linha 1/],
  ])('recusa %s', (_case, override, message) => {
    const result = toRecipeInput(values(override));

    expect(result).toHaveProperty('error');
    expect((result as { error: string }).error).toMatch(message);
  });
});
