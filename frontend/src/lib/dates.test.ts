import { describe, expect, it } from 'vitest';
import { currentMonth, formatDate, formatMonth, parseMonth, shiftMonth, todayIso } from './dates';

describe('datas', () => {
  it('formata a data sem mudar o dia por causa do fuso', () => {
    expect(formatDate('2026-11-01')).toBe('01/11/2026');
    expect(formatDate('2026-12-31')).toBe('31/12/2026');
  });

  it('usa o relógio local para hoje e para o mês atual', () => {
    const lateNight = new Date(2026, 10, 28, 23, 30); // 28/11, 23h30 no horário local
    expect(todayIso(lateNight)).toBe('2026-11-28');
    expect(currentMonth(lateNight)).toBe('2026-11');
  });

  it('escreve o mês por extenso', () => {
    expect(formatMonth('2026-11')).toBe('novembro de 2026');
    expect(formatMonth('2027-03')).toBe('março de 2027');
  });

  it('avança e volta meses, virando o ano', () => {
    expect(shiftMonth('2026-11', 1)).toBe('2026-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-05', -12)).toBe('2025-05');
  });

  it('aceita só meses válidos da URL', () => {
    expect(parseMonth('2026-11')).toBe('2026-11');
    expect(parseMonth('2026-13')).toBeNull();
    expect(parseMonth('novembro')).toBeNull();
    expect(parseMonth(null)).toBeNull();
  });
});
