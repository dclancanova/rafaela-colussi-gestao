import { describe, expect, it } from 'vitest';
import { unitCostCents } from './supply-cost.js';

describe('unitCostCents', () => {
  it('divide o preço da embalagem pela quantidade, sem arredondar', () => {
    // Farinha: 1 kg por R$ 6,50
    expect(unitCostCents(650, 1000)).toBe(0.65);
    // Leite condensado: 395 g por R$ 7,99 (dízima: precisão total)
    expect(unitCostCents(799, 395)).toBeCloseTo(2.0227848, 6);
  });

  it('funciona com unidades e com insumo de custo zero', () => {
    expect(unitCostCents(1500, 100)).toBe(15); // 100 caixinhas por R$ 15,00
    expect(unitCostCents(0, 50)).toBe(0);
  });

  it('recusa quantidade zero (seria divisão por zero)', () => {
    expect(() => unitCostCents(650, 0)).toThrow(RangeError);
  });
});
