import { describe, expect, it } from 'vitest';
import { formatPackage, formatUnitCost } from './supply-format';

const plain = (text: string) => text.replace(/\s/g, ' ');

describe('formatPackage', () => {
  it('mostra a embalagem como está na nota', () => {
    expect(plain(formatPackage(1000, 'g', 650))).toBe('1.000 g por R$ 6,50');
    expect(plain(formatPackage(10, 'un', 2500))).toBe('10 un por R$ 25,00');
  });
});

describe('formatUnitCost', () => {
  it('mostra gramas por kg e ml por litro', () => {
    expect(plain(formatUnitCost(0.65, 'g'))).toBe('R$ 6,50/kg');
    expect(plain(formatUnitCost(0.5, 'ml'))).toBe('R$ 5,00/L');
  });

  it('mostra unidades por unidade', () => {
    expect(plain(formatUnitCost(250, 'un'))).toBe('R$ 2,50/un');
  });
});
