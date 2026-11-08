import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from './password.js';

describe('password', () => {
  it('gera um hash argon2id e nunca guarda a senha em texto puro', async () => {
    const hash = await hashPassword('minha-senha-segura');

    expect(hash).toMatch(/^\$argon2id\$/);
    expect(hash).not.toContain('minha-senha-segura');
  });

  it('aceita a senha correta', async () => {
    const hash = await hashPassword('minha-senha-segura');

    expect(await verifyPassword(hash, 'minha-senha-segura')).toBe(true);
  });

  it('rejeita uma senha incorreta', async () => {
    const hash = await hashPassword('minha-senha-segura');

    expect(await verifyPassword(hash, 'outra-senha-qualquer')).toBe(false);
  });

  it('gera hashes diferentes para a mesma senha (salt aleatório)', async () => {
    const first = await hashPassword('minha-senha-segura');
    const second = await hashPassword('minha-senha-segura');

    expect(first).not.toBe(second);
  });
});