import { describe, expect, it } from 'vitest';
import { formatQuantity, formatUnitCost, parseQuantity, quantityToInput } from './units';

const plain = (text: string) => text.replace(/\s/g, ' ');

describe('formatUnitCost', () => {
  it('mostra gramas por kg e ml por litro', () => {
    expect(plain(formatUnitCost(0.65, 'g'))).toBe('R$ 6,50/kg');
    expect(plain(formatUnitCost(0.5, 'ml'))).toBe('R$ 5,00/L');
  });

  it('mostra unidades por unidade', () => {
    expect(plain(formatUnitCost(250, 'un'))).toBe('R$ 2,50/un');
  });
});

describe('formatQuantity', () => {
  it('usa ponto de milhar e vírgula decimal, até 3 casas', () => {
    expect(formatQuantity(1000)).toBe('1.000');
    expect(formatQuantity(2.5)).toBe('2,5');
    expect(formatQuantity(0.125)).toBe('0,125');
  });
});

describe('parseQuantity', () => {
  it.each([
    ['2', 2],
    ['2,5', 2.5],
    ['0,125', 0.125],
    ['1000', 1000],
    ['1.000', 1000],
    ['1.000,5', 1000.5],
    [' 395 ', 395],
  ])('"%s" → %d', (text, value) => {
    expect(parseQuantity(text)).toBe(value);
  });

  it.each(['', 'abc', '2.5', '0,1234', '-1', '2,'])('recusa "%s"', (text) => {
    expect(parseQuantity(text)).toBeNull();
  });

  it('ida e volta com o formato do campo', () => {
    for (const value of [1, 2.5, 0.125, 1000, 1000.5]) {
      expect(parseQuantity(quantityToInput(value))).toBe(value);
    }
  });
});
