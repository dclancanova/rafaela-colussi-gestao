import { describe, expect, it } from 'vitest';
import { marginLevel, previewPricing } from './pricing';

describe('previewPricing', () => {
  // Os mesmos números do teste do backend (pricing.test.ts): as duas contas precisam bater.
  it('dá o mesmo resultado do backend', () => {
    expect(
      previewPricing(4200, 12000, { indirectCostBasisPoints: 2000, targetMarginBasisPoints: 6000 }),
    ).toEqual({
      directCostCents: 4200,
      indirectCostCents: 840,
      totalCostCents: 5040,
      profitCents: 6960,
      marginRatio: 0.58,
      suggestedPriceCents: 12600,
    });
  });

  it('arredonda o sugerido para cima, sem errar em valores exatos', () => {
    const noIndirect = { indirectCostBasisPoints: 0, targetMarginBasisPoints: 6000 };
    expect(previewPricing(5041, 0, noIndirect).suggestedPriceCents).toBe(12603);
    expect(previewPricing(42, 0, noIndirect).suggestedPriceCents).toBe(105);
  });
});

describe('marginLevel', () => {
  it('classifica prejuízo, abaixo e na meta', () => {
    expect(marginLevel(-0.1, 6000)).toBe('loss');
    expect(marginLevel(0.5, 6000)).toBe('below-target');
    expect(marginLevel(0.6, 6000)).toBe('on-target');
    expect(marginLevel(0.7, 6000)).toBe('on-target');
    expect(marginLevel(null, 6000)).toBeNull();
  });
});
