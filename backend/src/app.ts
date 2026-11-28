import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { healthRouter } from './modules/health/health.routes.js';
import { recipesRouter } from './modules/recipes/recipes.routes.js';
import { suppliesRouter } from './modules/supplies/supplies.routes.js';
import {
  createForgotPasswordRateLimiter,
  createLoginRateLimiter,
  createResetPasswordRateLimiter,
} from './modules/auth/auth.rate-limit.js';
import { notFound } from './shared/middleware/not-found.js';
import { errorHandler } from './shared/middleware/error-handler.js';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  app.use('/api/health', healthRouter);
  app.use('/api/auth/login', createLoginRateLimiter());
  app.use('/api/auth/forgot-password', createForgotPasswordRateLimiter());
  app.use('/api/auth/reset-password', createResetPasswordRateLimiter());
  app.use('/api/auth', authRouter);
  app.use('/api/supplies', suppliesRouter);
  app.use('/api/recipes', recipesRouter);

  // Estes dois SEMPRE por último, nesta ordem
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
