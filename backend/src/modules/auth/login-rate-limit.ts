import { rateLimit } from 'express-rate-limit';
import { TooManyRequestsError } from '../../shared/errors.js';

const FIFTEEN_MINUTES = 15 * 60 * 1000;

/** Limita tentativas de login falhas por IP. Cada chamada cria uma contagem nova. */
export function createLoginRateLimiter() {
  return rateLimit({
    windowMs: FIFTEEN_MINUTES,
    limit: 10,
    // Logins bem-sucedidos não contam: só quem erra muito é bloqueado.
    skipSuccessfulRequests: true,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, _res, next) => next(new TooManyRequestsError()),
  });
}
