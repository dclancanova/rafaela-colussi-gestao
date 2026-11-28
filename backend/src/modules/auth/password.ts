import { hash, verify } from '@node-rs/argon2';
import { z } from 'zod';

// Argon2id é o algoritmo padrão desta biblioteca.
// Custo de memória (em KiB) e de tempo alinhados às recomendações mínimas atuais da OWASP.
// Aumentar estes valores deixa o hash mais caro para atacantes (e um pouco mais lento para nós).
const ARGON2_OPTIONS = {
  memoryCost: 19456, // ~19 MiB
  timeCost: 2,
  parallelism: 1,
} as const;

export const MIN_PASSWORD_LENGTH = 10;
// Limite superior evita gastar CPU com hash de textos gigantes.
export const MAX_PASSWORD_LENGTH = 256;

/** Regra única para senhas novas (seed, script de redefinição e "esqueci minha senha"). */
export const newPasswordSchema = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `A senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres`)
  .max(MAX_PASSWORD_LENGTH, 'Senha longa demais');

export function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}

export function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  return verify(passwordHash, password);
}

let dummyHash: Promise<string> | undefined;

/**
 * Gasta o mesmo tempo de uma verificação real.
 * Usada no login quando o e-mail não existe, para que o tempo de resposta
 * não revele quais e-mails têm conta.
 */
export async function verifyAgainstDummy(password: string): Promise<void> {
  dummyHash ??= hashPassword('senha-falsa-apenas-para-igualar-o-tempo');
  await verifyPassword(await dummyHash, password);
}
