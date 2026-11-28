import { describe, expect, it } from 'vitest';
import { basisPointsToInput, formatBasisPoints, formatPercent, parsePercentToBasisPoints } from './percent';

const plain = (text: string) => text.replace(/\s/g, ' ');

describe('formatação', () => {
  it('mostra frações e pontos-base como percentual', () => {
    expect(plain(formatPercent(0.655))).toBe('65,5%');
    expect(plain(formatPercent(-0.25))).toBe('-25%');
    expect(plain(formatBasisPoints(2050))).toBe('20,5%');
  });
});

describe('parsePercentToBasisPoints', () => {
  it.each([
    ['20', 2000],
    ['20,5', 2050],
    ['20,55', 2055],
    ['0', 0],
    ['20%', 2000],
    [' 7,25 % ', 725],
  ])('"%s" → %i', (text, basisPoints) => {
    expect(parsePercentToBasisPoints(text)).toBe(basisPoints);
  });

  it.each(['', 'abc', '20.5', '20,555', '-5'])('recusa "%s"', (text) => {
    expect(parsePercentToBasisPoints(text)).toBeNull();
  });

  it('ida e volta com o formato do campo', () => {
    for (const basisPoints of [0, 5, 2000, 2050, 2055, 9500]) {
      expect(parsePercentToBasisPoints(basisPointsToInput(basisPoints))).toBe(basisPoints);
    }
  });
});
