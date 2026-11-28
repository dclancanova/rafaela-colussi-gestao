import { describe, expect, it } from 'vitest';
import { formatPackage } from './supply-format';

const plain = (text: string) => text.replace(/\s/g, ' ');

describe('formatPackage', () => {
  it('mostra a embalagem como está na nota', () => {
    expect(plain(formatPackage(1000, 'g', 650))).toBe('1.000 g por R$ 6,50');
    expect(plain(formatPackage(10, 'un', 2500))).toBe('10 un por R$ 25,00');
  });
});
