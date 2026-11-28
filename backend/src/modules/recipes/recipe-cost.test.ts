import { describe, expect, it } from 'vitest';
import {
  createRecipeCostCalculator,
  findCycleCulprit,
  type CostRecipe,
  type CostSupply,
} from './recipe-cost.js';

// Insumos: 1 = leite condensado (395 g por R$ 7,90), 2 = chocolate (1000 g por R$ 40,00),
//          3 = caixa (10 un por R$ 25,00), 4 = farinha (1000 g por R$ 6,50)
const supplies = new Map<number, CostSupply>([
  [1, { packagePriceCents: 790, packageQuantity: 395 }], // 2 centavos/g
  [2, { packagePriceCents: 4000, packageQuantity: 1000 }], // 4 centavos/g
  [3, { packagePriceCents: 2500, packageQuantity: 10 }], // 250 centavos/un
  [4, { packagePriceCents: 650, packageQuantity: 1000 }], // 0,65 centavo/g
]);

const supply = (supplyId: number, quantity: number) => ({ supplyId, subRecipeId: null, quantity });
const sub = (subRecipeId: number, quantity: number) => ({ supplyId: null, subRecipeId, quantity });

describe('createRecipeCostCalculator', () => {
  // 10 = Recheio de brigadeiro: rende 500 g
  // 20 = Massa: rende 1 un
  // 30 = Bolo: rende 1 un; usa 250 g de recheio, 1 massa e 1 caixa
  const recipes = new Map<number, CostRecipe>([
    [10, { yieldQuantity: 500, items: [supply(1, 395), supply(2, 100)] }],
    [20, { yieldQuantity: 1, items: [supply(4, 300)] }],
    [30, { yieldQuantity: 1, items: [sub(10, 250), sub(20, 1), supply(3, 1)] }],
  ]);

  it('soma os insumos da receita', () => {
    const calc = createRecipeCostCalculator(supplies, recipes);

    // 395 g × 2 + 100 g × 4 = 790 + 400 = 1190 centavos
    expect(calc.totalCostCents(10)).toBe(1190);
    expect(calc.costPerYieldUnitCents(10)).toBeCloseTo(2.38); // 1190 ÷ 500 g
  });

  it('usa o custo por unidade de rendimento das sub-receitas', () => {
    const calc = createRecipeCostCalculator(supplies, recipes);

    // 250 g de recheio × 2,38 + 1 massa × 195 + 1 caixa × 250 = 595 + 195 + 250
    expect(calc.totalCostCents(30)).toBeCloseTo(1040);
  });

  it('não arredonda no meio do caminho (decisão AF)', () => {
    const calc = createRecipeCostCalculator(supplies, recipes);

    // 3 g de farinha a 0,65 centavo/g = 1,95 centavo: fica fracionário até o total.
    expect(calc.itemCostCents(supply(4, 3))).toBeCloseTo(1.95);
  });

  it('calcula sub-receitas em vários níveis', () => {
    const nested = new Map<number, CostRecipe>([
      ...recipes,
      // 40 = Kit com 2 bolos (rende 1 un)
      [40, { yieldQuantity: 1, items: [sub(30, 2)] }],
    ]);
    const calc = createRecipeCostCalculator(supplies, nested);

    expect(calc.totalCostCents(40)).toBeCloseTo(2080);
  });

  it('recusa ciclo em vez de entrar em laço infinito', () => {
    const cyclic = new Map<number, CostRecipe>([
      [1, { yieldQuantity: 1, items: [sub(2, 1)] }],
      [2, { yieldQuantity: 1, items: [sub(1, 1)] }],
    ]);
    const calc = createRecipeCostCalculator(supplies, cyclic);

    expect(() => calc.totalCostCents(1)).toThrow(/Ciclo/);
  });
});

describe('findCycleCulprit', () => {
  // Bolo (3) usa Recheio (2), que usa Base (1).
  const subRecipesOf = new Map<number, number[]>([
    [3, [2]],
    [2, [1]],
  ]);

  it('aceita usar receitas que não dependem desta', () => {
    expect(findCycleCulprit(3, [1, 2], subRecipesOf)).toBeNull();
    expect(findCycleCulprit(4, [3], subRecipesOf)).toBeNull();
  });

  it('acusa ciclo direto e indireto, apontando a culpada', () => {
    expect(findCycleCulprit(2, [3], subRecipesOf)).toBe(3); // Recheio usaria Bolo, que usa Recheio
    expect(findCycleCulprit(1, [5, 3], subRecipesOf)).toBe(3); // Base usaria Bolo → Recheio → Base
  });

  it('acusa a receita usando a si mesma', () => {
    expect(findCycleCulprit(7, [7], subRecipesOf)).toBe(7);
  });
});
