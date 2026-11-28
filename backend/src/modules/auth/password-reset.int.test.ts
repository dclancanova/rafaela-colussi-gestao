import { eq } from 'drizzle-orm';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import { db } from '../../database/client.js';
import { auditLog, passwordResetTokens, sessions } from '../../database/schema/index.js';
import { testOutbox } from '../../shared/mailer.js';
import { createTestUser, resetDatabase } from '../../test/db.js';
import { INVALID_RESET_TOKEN_MESSAGE } from './password-reset.service.js';

// App novo a cada teste: cada app tem a própria contagem do limite de 5 pedidos.
// Com um app só, os pedidos dos testes se somariam e os últimos receberiam 429.
let app = createApp();

beforeEach(async () => {
  app = createApp();
  await resetDatabase();
  testOutbox.length = 0;
});

/** Pede o link e devolve o token que veio no "e-mail". */
async function requestToken(email: string): Promise<string> {
  await request(app).post('/api/auth/forgot-password').send({ email });
  const mail = testOutbox.at(-1);
  const link = mail?.text.match(/https?:\/\/\S+/)?.[0];
  return new URL(link!).searchParams.get('token')!;
}

describe('POST /api/auth/forgot-password', () => {
  it('envia o link para uma conta ativa e guarda só o hash do token', async () => {
    const user = await createTestUser();

    const res = await request(app).post('/api/auth/forgot-password').send({ email: user.email });

    expect(res.status).toBe(204);
    expect(testOutbox).toHaveLength(1);
    expect(testOutbox[0]!.to).toBe(user.email);
    expect(testOutbox[0]!.text).toContain('/redefinir-senha?token=');

    const token = await requestToken(user.email);
    const stored = await db.select().from(passwordResetTokens);
    expect(stored).toHaveLength(1);
    expect(stored[0]!.tokenHash).not.toBe(token);
  });

  it('responde igual para e-mail inexistente e conta desativada, sem enviar nada', async () => {
    const inactive = await createTestUser({ email: 'inativa@example.com', isActive: false });

    const responses = await Promise.all([
      request(app).post('/api/auth/forgot-password').send({ email: 'ninguem@example.com' }),
      request(app).post('/api/auth/forgot-password').send({ email: inactive.email }),
    ]);

    for (const res of responses) {
      expect(res.status).toBe(204);
    }
    expect(testOutbox).toHaveLength(0);
    expect(await db.select().from(passwordResetTokens)).toHaveLength(0);
  });

  it('aceita o e-mail com maiúsculas e espaços', async () => {
    const user = await createTestUser({ email: 'rafaela@example.com' });

    await request(app).post('/api/auth/forgot-password').send({ email: '  Rafaela@Example.COM ' });

    expect(testOutbox.map((mail) => mail.to)).toEqual([user.email]);
  });

  it('um pedido novo invalida o link anterior', async () => {
    const user = await createTestUser();
    const first = await requestToken(user.email);
    await requestToken(user.email);

    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: first, password: 'senha-nova-segura-1' });

    expect(res.status).toBe(400);
    expect(await db.select().from(passwordResetTokens)).toHaveLength(1);
  });

  it('limita a 5 pedidos por IP a cada 15 minutos', async () => {
    const limitedApp = createApp();

    for (let attempt = 1; attempt <= 5; attempt++) {
      const res = await request(limitedApp)
        .post('/api/auth/forgot-password')
        .send({ email: 'ninguem@example.com' });
      expect(res.status).toBe(204);
    }

    const blocked = await request(limitedApp)
      .post('/api/auth/forgot-password')
      .send({ email: 'ninguem@example.com' });
    expect(blocked.status).toBe(429);
  });
});

describe('POST /api/auth/reset-password', () => {
  it('troca a senha, encerra as sessões e registra na auditoria', async () => {
    const user = await createTestUser();
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ email: user.email, password: user.password });
    const token = await requestToken(user.email);

    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token, password: 'senha-nova-segura-1' });

    expect(res.status).toBe(204);
    expect((await agent.get('/api/auth/me')).status).toBe(401);
    expect(await db.select().from(sessions)).toHaveLength(0);

    const oldLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: user.password });
    expect(oldLogin.status).toBe(401);
    const newLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: 'senha-nova-segura-1' });
    expect(newLogin.status).toBe(200);

    const actions = (await db.select().from(auditLog).orderBy(auditLog.id)).map((entry) => entry.action);
    expect(actions).toEqual(['login', 'password_reset_requested', 'password_reset', 'login']);
    const [reset] = await db.select().from(auditLog).where(eq(auditLog.action, 'password_reset'));
    expect(reset).toMatchObject({ userId: user.id, entityId: user.id, changes: { via: 'reset_link' } });
  });

  it('não aceita o mesmo link duas vezes', async () => {
    const user = await createTestUser();
    const token = await requestToken(user.email);

    await request(app).post('/api/auth/reset-password').send({ token, password: 'senha-nova-segura-1' });
    const second = await request(app)
      .post('/api/auth/reset-password')
      .send({ token, password: 'outra-senha-segura-2' });

    expect(second.status).toBe(400);
    expect(second.body.error).toEqual({ code: 'INVALID_RESET_TOKEN', message: INVALID_RESET_TOKEN_MESSAGE });
  });

  it('não aceita link vencido', async () => {
    const user = await createTestUser();
    const token = await requestToken(user.email);
    await db.update(passwordResetTokens).set({ expiresAt: new Date(Date.now() - 1000) });

    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token, password: 'senha-nova-segura-1' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_RESET_TOKEN');
  });

  it('não aceita token inventado', async () => {
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: 'token-que-nao-existe', password: 'senha-nova-segura-1' });

    expect(res.status).toBe(400);
  });

  it('exige senha com o tamanho mínimo, sem gastar o link', async () => {
    const user = await createTestUser();
    const token = await requestToken(user.email);

    const res = await request(app).post('/api/auth/reset-password').send({ token, password: 'curta' });

    expect(res.status).toBe(422);
    expect(res.body.error.details[0].field).toBe('password');
    const [stored] = await db.select().from(passwordResetTokens);
    expect(stored!.usedAt).toBeNull();
  });
});
