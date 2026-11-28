import { sql } from 'drizzle-orm';
import { afterAll } from 'vitest';
import { db, pool } from '../database/client.js';
import { users } from '../database/schema/index.js';
import { hashPassword } from '../modules/auth/password.js';
import { assertIsTestDatabase } from './test-database-url.js';

assertIsTestDatabase(process.env.DATABASE_URL ?? '');

afterAll(async () => {
  await pool.end();
});

export async function resetDatabase(): Promise<void> {
  await db.execute(
    sql`truncate table audit_log, password_reset_tokens, sessions, recipe_items, recipes, supplies, users restart identity cascade`,
  );
}

type NewTestUser = {
  name?: string;
  email?: string;
  password?: string;
  role?: 'admin' | 'member';
  isActive?: boolean;
};

export async function createTestUser(overrides: NewTestUser = {}) {
  const password = overrides.password ?? 'senha-de-teste-123';
  const [user] = await db
    .insert(users)
    .values({
      name: overrides.name ?? 'Usuária Teste',
      email: overrides.email ?? 'teste@example.com',
      passwordHash: await hashPassword(password),
      role: overrides.role ?? 'member',
      isActive: overrides.isActive ?? true,
    })
    .returning();

  return { ...user!, password };
}
