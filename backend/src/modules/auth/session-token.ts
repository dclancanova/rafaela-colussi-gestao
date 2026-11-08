import { createHash, randomBytes } from 'node:crypto';

// Decisão U: sessão de 14 dias.
export const SESSION_DURATION_MS = 14 * 24 * 60 * 60 * 1000;

/** Token aleatório de 32 bytes (256 bits), em texto seguro para cookies. É isto que vai ao navegador. */
export function generateSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

/** O banco guarda apenas este hash (decisão R). Se o banco vazar, os hashes não servem para entrar. */
export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function calculateExpiry(now: Date = new Date()): Date {
  return new Date(now.getTime() + SESSION_DURATION_MS);
}