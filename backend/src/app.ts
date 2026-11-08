import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import { healthRouter } from './modules/health/health.routes.js';
import { notFound } from './shared/middleware/not-found.js';
import { errorHandler } from './shared/middleware/error-handler.js';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(express.json({ limit: '1mb' }));

  app.use('/api/health', healthRouter);

  // Estes dois SEMPRE por último, nesta ordem
  app.use(notFound);
  app.use(errorHandler);

  return app;
}