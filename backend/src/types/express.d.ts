import type { AuthContext } from '../modules/auth/auth.service.js';

declare global {
  namespace Express {
    interface Request {
      /** Preenchido por requireAuth. */
      auth?: AuthContext;
    }
  }
}

export {};
