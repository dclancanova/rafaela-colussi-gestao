import { Router } from 'express';
import { pool } from '../../database/client.js';
import { logger } from '../../shared/logger.js';

export const healthRouter = Router();

healthRouter.get('/', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

healthRouter.get('/db', async (_req, res) => {
  try {
    await pool.query('select 1');
    res.json({ status: 'ok', database: 'up' });
  } catch (err) {
    logger.error({ err }, 'Health check do banco falhou');
    res.status(503).json({ status: 'error', database: 'down' });
  }
});