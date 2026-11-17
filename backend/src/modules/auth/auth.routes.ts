import { Router } from 'express';
import { z } from 'zod';
import { clearSessionCookie, readSessionToken, setSessionCookie } from './auth.cookie.js';
import { getAuth, requireAuth } from './auth.middleware.js';
import { login, logout } from './auth.service.js';

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email('Informe um e-mail válido')),
  // Limite superior evita gastar CPU com hash de textos gigantes.
  password: z.string().min(1, 'Informe a senha').max(256, 'Senha longa demais'),
});

export const authRouter = Router();

authRouter.post('/login', async (req, res) => {
  const { email, password } = loginSchema.parse(req.body ?? {});
  const result = await login(email, password);

  setSessionCookie(res, result.token, result.expiresAt);
  res.json({ user: result.user });
});

authRouter.post('/logout', async (req, res) => {
  const token = readSessionToken(req);
  if (token) {
    await logout(token);
  }

  clearSessionCookie(res);
  res.status(204).end();
});

authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ user: getAuth(req).user });
});
