import { describe, it, expect } from 'vitest';
import {
  calculateExpiry,
  generateSessionToken,
  hashSessionToken,
  SESSION_DURATION_MS,
} from './session-token.js';

describe('session-token', () => {
  it('gera tokens com 43 caracteres (32 bytes em base64url) e únicos', () => {
    const first = generateSessionToken();
    const second = generateSessionToken();

    expect(first).toHaveLength(43);
    expect(first).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(first).not.toBe(second);
  });

  it('gera o mesmo hash para o mesmo token', () => {
    const token = generateSessionToken();

    expect(hashSessionToken(token)).toBe(hashSessionToken(token));
  });

  it('gera um hash SHA-256 de 64 caracteres, diferente do token', () => {
    const token = generateSessionToken();
    const hash = hashSessionToken(token);

    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]+$/);
    expect(hash).not.toBe(token);
  });

  it('calcula a expiração 14 dias depois da data informada', () => {
    const now = new Date('2026-11-08T12:00:00.000Z');

    expect(calculateExpiry(now).toISOString()).toBe('2026-11-22T12:00:00.000Z');
    expect(SESSION_DURATION_MS).toBe(14 * 24 * 60 * 60 * 1000);
  });
});