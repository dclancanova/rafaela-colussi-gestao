import { describe, expect, it } from 'vitest';
import { calculateProductPricing } from './pricing.js';

const settings = { indirectCostBasisPoints: 2000, targetMarginBasisPoints: 6000 }; // +20%, meta 60%

describe('calculateProductPricing', () => {
  it('soma os indiretos, calcula lucro, margem e preço sugerido', () => {
    // Ficha custa R$ 42,00; vendido a R$ 120,00
    const result = calculateProductPricing(4200, 12000, settings);

    expect(result).toEqual({
      directCostCents: 4200,
      indirectCostCents: 840, // 20% de 42,00
      totalCostCents: 5040,
      profitCents: 6960,
      marginRatio: 0.58,
      suggestedPriceCents: 12600, // 50,40 ÷ 0,40
    });
  });

  it('sem indiretos, o custo total é o custo da ficha', () => {
    const result = calculateProductPricing(4200, 12000, {
      indirectCostBasisPoints: 0,
      targetMarginBasisPoints: 6000,
    });

    expect(result.totalCostCents).toBe(4200);
    expect(result.indirectCostCents).toBe(0);
    expect(result.suggestedPriceCents).toBe(10500);
  });

  it('arredonda só no fim, e direto + indiretos fecha com o total', () => {
    // 3,333… centavos de custo direto, +20% = 4 centavos
    const result = calculateProductPricing(10 / 3, 100, settings);

    expect(result.directCostCents).toBe(3);
    expect(result.totalCostCents).toBe(4);
    expect(result.directCostCents + result.indirectCostCents).toBe(result.totalCostCents);
  });

  it('arredonda o preço sugerido para cima, sem errar por imprecisão do JavaScript', () => {
    // 50,41 ÷ 0,4 = 126,025 → 126,03
    expect(
      calculateProductPricing(5041, 0, { indirectCostBasisPoints: 0, targetMarginBasisPoints: 6000 })
        .suggestedPriceCents,
    ).toBe(12603);
    // 42 ÷ 0,4 = 105 exatos: não pode virar 106 por causa de 105,00000000001
    expect(
      calculateProductPricing(42, 0, { indirectCostBasisPoints: 0, targetMarginBasisPoints: 6000 })
        .suggestedPriceCents,
    ).toBe(105);
  });

  it('mostra prejuízo como lucro e margem negativos', () => {
    const result = calculateProductPricing(5000, 4000, {
      indirectCostBasisPoints: 0,
      targetMarginBasisPoints: 0,
    });

    expect(result.profitCents).toBe(-1000);
    expect(result.marginRatio).toBe(-0.25);
  });

  it('não calcula margem sem preço', () => {
    expect(calculateProductPricing(4200, 0, settings).marginRatio).toBeNull();
  });
});
