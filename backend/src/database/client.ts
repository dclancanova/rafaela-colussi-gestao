import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { env } from '../config/env.js';
import { logger } from '../shared/logger.js';
import * as schema from './schema/index.js';

export const pool = new pg.Pool({ connectionString: env.DATABASE_URL, max: 10 });

// Sem este handler, um erro em conexão ociosa derrubaria o servidor inteiro.
pool.on('error', (err) => {
  logger.error({ err }, 'Erro inesperado em conexão ociosa do PostgreSQL');
});

export const db = drizzle(pool, { schema });