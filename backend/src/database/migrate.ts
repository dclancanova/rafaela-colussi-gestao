import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { logger } from '../shared/logger.js';
import { db, pool } from './client.js';

try {
  await migrate(db, { migrationsFolder: './src/database/migrations' });
  logger.info('Migrations aplicadas com sucesso');
} catch (err) {
  logger.error({ err }, 'Falha ao aplicar migrations');
  process.exitCode = 1;
} finally {
  await pool.end();
}