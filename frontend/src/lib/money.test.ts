import { describe, expect, it } from 'vitest';
import { centsToInput, formatCents, parseMoneyToCents } from './money';

// O Intl usa espaço não separável entre "R$" e o número; normaliza para comparar.
const plain = (text: string) => text.replace(/\s/g, ' ');

describe('formatCents', () => {
  it('formata em reais', () => {
    expect(plain(formatCents(650))).toBe('R$ 6,50');
    expect(plain(formatCents(123456))).toBe('R$ 1.234,56');
    expect(plain(formatCents(0))).toBe('R$ 0,00');
  });

  it('arredonda centavos fracionários só na exibição', () => {
    expect(plain(formatCents(0.65))).toBe('R$ 0,01');
    expect(plain(formatCents(650.4))).toBe('R$ 6,50');
  });
});

describe('parseMoneyToCents', () => {
  it.each([
    ['6', 600],
    ['6,5', 650],
    ['6,50', 650],
    ['0,99', 99],
    ['1.234,56', 123456],
    ['1234,56', 123456],
    ['R$ 6,50', 650],
    ['  7,99  ', 799],
  ])('"%s" → %i centavos', (text, cents) => {
    expect(parseMoneyToCents(text)).toBe(cents);
  });

  it.each(['', 'abc', '6.50', '6,505', '-6,50', '1.23,00', '6,'])('recusa "%s"', (text) => {
    expect(parseMoneyToCents(text)).toBeNull();
  });

  it('não sofre com erro de arredondamento de decimais', () => {
    // 1.15 * 100 = 114.99999999999999 em JavaScript; aqui tem que dar 115.
    expect(parseMoneyToCents('1,15')).toBe(115);
    expect(parseMoneyToCents('4,35')).toBe(435);
  });
});

describe('centsToInput', () => {
  it('volta para o formato do campo, e o caminho de ida e volta é exato', () => {
    expect(centsToInput(650)).toBe('6,50');
    expect(centsToInput(5)).toBe('0,05');
    expect(centsToInput(123456)).toBe('1234,56');
    for (const cents of [0, 1, 99, 100, 115, 799, 123456]) {
      expect(parseMoneyToCents(centsToInput(cents))).toBe(cents);
    }
  });
});
