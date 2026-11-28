import { describe, expect, it } from 'vitest';
import { monthRange, todayInBusinessTimeZone } from './dates.js';

describe('todayInBusinessTimeZone', () => {
  it('usa o dia de São Paulo, não o do servidor', () => {
    // 01h00 UTC do dia 29 = 22h00 do dia 28 em São Paulo (UTC−3)
    expect(todayInBusinessTimeZone(new Date('2026-11-29T01:00:00Z'))).toBe('2026-11-28');
    // 03h00 UTC do dia 29 = 00h00 do dia 29 em São Paulo
    expect(todayInBusinessTimeZone(new Date('2026-11-29T03:00:00Z'))).toBe('2026-11-29');
  });
});

describe('monthRange', () => {
  it('vai do dia 1 ao dia 1 do mês seguinte', () => {
    expect(monthRange('2026-11')).toEqual({ start: '2026-11-01', end: '2026-12-01' });
  });

  it('vira o ano em dezembro', () => {
    expect(monthRange('2026-12')).toEqual({ start: '2026-12-01', end: '2027-01-01' });
  });
});
