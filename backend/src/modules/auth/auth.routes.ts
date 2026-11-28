import { Router } from 'express';
import { z } from 'zod';
import { clearSessionCookie, readSessionToken, setSessionCookie } from './auth.cookie.js';
import { getAuth, requireAuth } from './auth.middleware.js';
import { login, logout } from './auth.service.js';
import { requestPasswordReset, resetPassword } from './password-reset.service.js';
import { MAX_PASSWORD_LENGTH, newPasswordSchema } from './password.js';

const emailSchema = z.string().trim().toLowerCase().pipe(z.email('Informe um e-mail válido'));

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Informe a senha').max(MAX_PASSWORD_LENGTH, 'Senha longa demais'),
});

const forgotPasswordSchema = z.object({ email: emailSchema });

const resetPasswordSchema = z.object({
  // Tokens têm 43 caracteres; o limite só barra lixo gigante.
  token: z.string().min(1, 'Link inválido').max(200, 'Link inválido'),
  password: newPasswordSchema,
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

// Sempre 204, exista a conta ou não: a resposta não revela quais e-mails estão cadastrados.
authRouter.post('/forgot-password', async (req, res) => {
  const { email } = forgotPasswordSchema.parse(req.body ?? {});
  await requestPasswordReset(email);
  res.status(204).end();
});

authRouter.post('/reset-password', async (req, res) => {
  const { token, password } = resetPasswordSchema.parse(req.body ?? {});
  await resetPassword(token, password);
  // Quem redefiniu pela própria máquina também perdeu a sessão: limpa o cookie, se houver.
  clearSessionCookie(res);
  res.status(204).end();
});
