import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import { assertIsTestDatabase, resolveTestDatabaseUrl } from './test-database-url.js';

/** Roda uma vez antes dos testes de integração: cria o banco de teste e aplica as migrations. */
export default async function setup() {
  const databaseUrl = resolveTestDatabaseUrl(process.env);
  if (!databaseUrl) {
    throw new Error('Defina DATABASE_URL (ou TEST_DATABASE_URL) no .env para os testes de integração');
  }
  const databaseName = assertIsTestDatabase(databaseUrl);

  const adminUrl = new URL(databaseUrl);
  adminUrl.pathname = '/postgres';
  const admin = new pg.Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  try {
    const existing = await admin.query('select 1 from pg_database where datname = $1', [databaseName]);
    if (existing.rowCount === 0) {
      await admin.query(`create database "${databaseName.replaceAll('"', '""')}"`);
    }
  } finally {
    await admin.end();
  }

  const pool = new pg.Pool({ connectionString: databaseUrl });
  try {
    await migrate(drizzle(pool), { migrationsFolder: './src/database/migrations' });
  } finally {
    await pool.end();
  }
}
