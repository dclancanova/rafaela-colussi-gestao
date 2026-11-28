import { rateLimit } from 'express-rate-limit';
import { TooManyRequestsError } from '../../shared/errors.js';

const FIFTEEN_MINUTES = 15 * 60 * 1000;

function createLimiter(limit: number, skipSuccessfulRequests: boolean) {
  return rateLimit({
    windowMs: FIFTEEN_MINUTES,
    limit,
    skipSuccessfulRequests,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, _res, next) => next(new TooManyRequestsError()),
  });
}

// Cada chamada cria uma contagem nova (um app de teste não afeta outro).

/** Login: 10 tentativas falhas por IP; logins certos não contam (decisão Y). */
export function createLoginRateLimiter() {
  return createLimiter(10, true);
}

/** "Esqueci minha senha": 5 pedidos por IP, contando todos (cada pedido pode gerar um e-mail). */
export function createForgotPasswordRateLimiter() {
  return createLimiter(5, false);
}

/** Uso do link: 10 tentativas falhas por IP; redefinições certas não contam. */
export function createResetPasswordRateLimiter() {
  return createLimiter(10, true);
}
