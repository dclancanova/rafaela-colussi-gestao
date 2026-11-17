import type { Request, RequestHandler } from 'express';
import { ForbiddenError, UnauthorizedError } from '../../shared/errors.js';
import { readSessionToken } from './auth.cookie.js';
import { findSession, type AuthContext, type AuthUser } from './auth.service.js';

/** Bloqueia a rota para quem não tem sessão válida (401). */
export const requireAuth: RequestHandler = async (req, _res, next) => {
  const token = readSessionToken(req);
  if (!token) {
    throw new UnauthorizedError();
  }

  const auth = await findSession(token);
  if (!auth) {
    throw new UnauthorizedError('Sessão inválida ou expirada');
  }

  req.auth = auth;
  next();
};

/** Exige um dos perfis informados (403). Deve vir depois de requireAuth. */
export function requireRole(...roles: AuthUser['role'][]): RequestHandler {
  return (req, _res, next) => {
    if (!roles.includes(getAuth(req).user.role)) {
      throw new ForbiddenError();
    }
    next();
  };
}

/** Lê a sessão já validada por requireAuth. */
export function getAuth(req: Request): AuthContext {
  if (!req.auth) {
    throw new UnauthorizedError();
  }
  return req.auth;
}
