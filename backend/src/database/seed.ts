import { z } from 'zod';
import { MIN_PASSWORD_LENGTH, hashPassword } from '../modules/auth/password.js';
import { logger } from '../shared/logger.js';
import { db, pool } from './client.js';
import { users } from './schema/index.js';

const passwordRule = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `A senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres`);

const seedSchema = z
  .object({
    SEED_DANIELA_EMAIL: z.email().transform((value) => value.toLowerCase()),
    SEED_DANIELA_PASSWORD: passwordRule,
    SEED_RAFAELA_EMAIL: z.email().transform((value) => value.toLowerCase()),
    SEED_RAFAELA_PASSWORD: passwordRule,
  })
  .refine((data) => data.SEED_DANIELA_EMAIL !== data.SEED_RAFAELA_EMAIL, {
    message: 'Os e-mails da Daniela e da Rafaela devem ser diferentes',
    path: ['SEED_RAFAELA_EMAIL'],
  });

try {
  const parsed = seedSchema.safeParse(process.env);

  if (!parsed.success) {
    logger.error('Variáveis do seed inválidas:');
    for (const issue of parsed.error.issues) {
      logger.error(`  - ${issue.path.join('.')}: ${issue.message}`);
    }
    process.exitCode = 1;
  } else {
    const input = parsed.data;

    const people = [
      { name: 'Daniela', email: input.SEED_DANIELA_EMAIL, password: input.SEED_DANIELA_PASSWORD },
      { name: 'Rafaela', email: input.SEED_RAFAELA_EMAIL, password: input.SEED_RAFAELA_PASSWORD },
    ];

    for (const person of people) {
      const passwordHash = await hashPassword(person.password);

      const inserted = await db
        .insert(users)
        .values({
          name: person.name,
          email: person.email,
          passwordHash,
          role: 'admin',
        })
        .onConflictDoNothing({ target: users.email })
        .returning({ id: users.id });

      if (inserted.length > 0) {
        logger.info(`Usuária criada: ${person.name} <${person.email}>`);
      } else {
        logger.info(`Usuária já existe, mantida sem alterações: ${person.email}`);
      }
    }
  }
} catch (err) {
  logger.error({ err }, 'Falha ao executar o seed');
  process.exitCode = 1;
} finally {
  await pool.end();
}