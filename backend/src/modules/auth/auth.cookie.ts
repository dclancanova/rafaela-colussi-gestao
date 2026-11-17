import type { CookieOptions, Request, Response } from 'express';
import { env } from '../../config/env.js';

export const SESSION_COOKIE_NAME = 'rc_session';

function baseOptions(): CookieOptions {
  return {
    httpOnly: true, // JavaScript do navegador não lê o cookie (decisão E)
    secure: env.NODE_ENV === 'production', // só HTTPS em produção
    sameSite: 'lax', // outros sites não enviam o cookie em POST/PUT/DELETE
    path: '/',
  };
}

export function setSessionCookie(res: Response, token: string, expiresAt: Date): void {
  res.cookie(SESSION_COOKIE_NAME, token, { ...baseOptions(), expires: expiresAt });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE_NAME, baseOptions());
}

export function readSessionToken(req: Request): string | null {
  const value: unknown = req.cookies?.[SESSION_COOKIE_NAME];
  return typeof value === 'string' && value.length > 0 ? value : null;
}
