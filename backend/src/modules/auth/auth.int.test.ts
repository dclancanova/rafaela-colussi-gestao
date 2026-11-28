import cookieParser from 'cookie-parser';
import { eq } from 'drizzle-orm';
import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import { db } from '../../database/client.js';
import { auditLog, sessions, users } from '../../database/schema/index.js';
import { errorHandler } from '../../shared/middleware/error-handler.js';
import { createTestUser, resetDatabase } from '../../test/db.js';
import { SESSION_COOKIE_NAME } from './auth.cookie.js';
import { requireAuth, requireRole } from './auth.middleware.js';
import { applyNewPassword, deleteExpiredSessions } from './auth.service.js';
import { hashPassword } from './password.js';

const app = createApp();

function sessionCookie(res: request.Response): string | undefined {
  const cookies = res.headers['set-cookie'] as unknown as string[] | undefined;
  return cookies?.find((cookie) => cookie.startsWith(`${SESSION_COOKIE_NAME}=`));
}

beforeEach(async () => {
  await resetDatabase();
});

describe('POST /api/auth/login', () => {
  it('cria a sessão, envia cookie httpOnly e devolve a usuária sem dados sensíveis', async () => {
    const user = await createTestUser();

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: user.password });

    expect(res.status).toBe(200);
    expect(res.body.user).toEqual({ id: user.id, name: user.name, email: user.email, role: 'member' });

    const cookie = sessionCookie(res);
    expect(cookie).toBeDefined();
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);

    const stored = await db.select().from(sessions).where(eq(sessions.userId, user.id));
    expect(stored).toHaveLength(1);
    // O banco guarda o hash, nunca o token (decisão R)
    const token = cookie!.split(';')[0]!.split('=')[1]!;
    expect(stored[0]!.tokenHash).not.toBe(token);
  });

  it('registra o último login sem alterar updated_at', async () => {
    const user = await createTestUser();

    await request(app).post('/api/auth/login').send({ email: user.email, password: user.password });

    const [after] = await db.select().from(users).where(eq(users.id, user.id));
    expect(after!.lastLoginAt).toBeInstanceOf(Date);
    expect(after!.updatedAt).toEqual(user.updatedAt);
  });

  it('aceita o e-mail com maiúsculas e espaços', async () => {
    const user = await createTestUser({ email: 'rafaela@example.com' });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: '  Rafaela@Example.COM ', password: user.password });

    expect(res.status).toBe(200);
  });

  it('responde igual para senha errada, e-mail inexistente e conta desativada', async () => {
    const active = await createTestUser({ email: 'ativa@example.com' });
    const inactive = await createTestUser({ email: 'inativa@example.com', isActive: false });

    const attempts = await Promise.all([
      request(app).post('/api/auth/login').send({ email: active.email, password: 'senha-errada-123' }),
      request(app).post('/api/auth/login').send({ email: 'ninguem@example.com', password: 'qualquer-coisa' }),
      request(app).post('/api/auth/login').send({ email: inactive.email, password: inactive.password }),
    ]);

    for (const res of attempts) {
      expect(res.status).toBe(401);
      expect(res.body.error).toEqual({ code: 'UNAUTHORIZED', message: 'E-mail ou senha incorretos' });
      expect(sessionCookie(res)).toBeUndefined();
    }
    expect(await db.select().from(sessions)).toHaveLength(0);
  });

  it('valida os campos', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'nao-e-email', password: '' });

    expect(res.status).toBe(422);
    expect(res.body.error.details.map((d: { field: string }) => d.field).sort()).toEqual([
      'email',
      'password',
    ]);
  });

  it('valida mesmo sem corpo', async () => {
    const res = await request(app).post('/api/auth/login');

    expect(res.status).toBe(422);
  });
});

describe('GET /api/auth/me', () => {
  it('devolve a usuária da sessão', async () => {
    const user = await createTestUser({ role: 'admin' });
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ email: user.email, password: user.password });

    const res = await agent.get('/api/auth/me');

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ id: user.id, email: user.email, role: 'admin' });
  });

  it('recusa sem cookie', async () => {
    const res = await request(app).get('/api/auth/me');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('recusa token desconhecido', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Cookie', `${SESSION_COOKIE_NAME}=token-inventado`);

    expect(res.status).toBe(401);
  });

  it('recusa sessão expirada', async () => {
    const user = await createTestUser();
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ email: user.email, password: user.password });
    await db.update(sessions).set({ expiresAt: new Date(Date.now() - 1000) });

    const res = await agent.get('/api/auth/me');

    expect(res.status).toBe(401);
  });

  it('recusa usuária desativada depois do login', async () => {
    const user = await createTestUser();
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ email: user.email, password: user.password });
    await db.update(users).set({ isActive: false }).where(eq(users.id, user.id));

    const res = await agent.get('/api/auth/me');

    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/logout', () => {
  it('apaga a sessão e limpa o cookie', async () => {
    const user = await createTestUser();
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ email: user.email, password: user.password });

    const res = await agent.post('/api/auth/logout');

    expect(res.status).toBe(204);
    expect(sessionCookie(res)).toMatch(/Expires=Thu, 01 Jan 1970/);
    expect(await db.select().from(sessions)).toHaveLength(0);
    expect((await agent.get('/api/auth/me')).status).toBe(401);
  });

  it('funciona mesmo sem sessão', async () => {
    const res = await request(app).post('/api/auth/logout');

    expect(res.status).toBe(204);
  });
});

describe('requireRole', () => {
  const protectedApp = express();
  protectedApp.use(cookieParser());
  protectedApp.get('/admin', requireAuth, requireRole('admin'), (_req, res) => {
    res.json({ ok: true });
  });
  protectedApp.use(errorHandler);

  async function loginAs(role: 'admin' | 'member') {
    const user = await createTestUser({ role });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: user.password });
    return sessionCookie(res)!.split(';')[0]!;
  }

  it('permite o perfil exigido', async () => {
    const cookie = await loginAs('admin');

    const res = await request(protectedApp).get('/admin').set('Cookie', cookie);

    expect(res.status).toBe(200);
  });

  it('recusa outro perfil com 403', async () => {
    const cookie = await loginAs('member');

    const res = await request(protectedApp).get('/admin').set('Cookie', cookie);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('recusa sem sessão com 401', async () => {
    const res = await request(protectedApp).get('/admin');

    expect(res.status).toBe(401);
  });
});

describe('auditoria', () => {
  it('registra o login bem-sucedido', async () => {
    const user = await createTestUser();

    await request(app).post('/api/auth/login').send({ email: user.email, password: user.password });

    const entries = await db.select().from(auditLog);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      userId: user.id,
      entityType: 'user',
      entityId: user.id,
      action: 'login',
    });
  });

  it('não registra login com senha errada', async () => {
    const user = await createTestUser();

    await request(app).post('/api/auth/login').send({ email: user.email, password: 'senha-errada-123' });

    expect(await db.select().from(auditLog)).toHaveLength(0);
  });

  it('registra o logout', async () => {
    const user = await createTestUser();
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ email: user.email, password: user.password });

    await agent.post('/api/auth/logout');

    const entries = await db.select().from(auditLog).orderBy(auditLog.id);
    expect(entries.map((entry) => entry.action)).toEqual(['login', 'logout']);
    expect(entries[1]).toMatchObject({
      userId: user.id,
      entityType: 'user',
      entityId: user.id,
    });
  });

  it('não registra logout sem sessão', async () => {
    await request(app).post('/api/auth/logout');

    expect(await db.select().from(auditLog)).toHaveLength(0);
  });
});

describe('deleteExpiredSessions', () => {
  it('apaga sessões vencidas e no limite, mantendo as válidas', async () => {
    const user = await createTestUser();
    const now = new Date('2026-11-21T12:00:00Z');
    const oneHour = 60 * 60 * 1000;

    await db.insert(sessions).values([
      { userId: user.id, tokenHash: 'hash-vencida', expiresAt: new Date(now.getTime() - oneHour) },
      { userId: user.id, tokenHash: 'hash-limite', expiresAt: now },
      { userId: user.id, tokenHash: 'hash-valida', expiresAt: new Date(now.getTime() + oneHour) },
    ]);

    const deleted = await deleteExpiredSessions(now);

    expect(deleted).toBe(2);
    const remaining = await db.select().from(sessions);
    expect(remaining.map((session) => session.tokenHash)).toEqual(['hash-valida']);
  });

  it('devolve 0 quando não há sessões vencidas', async () => {
    expect(await deleteExpiredSessions()).toBe(0);
  });
});

describe('limite de tentativas de login', () => {
  it('bloqueia com 429 depois de 10 tentativas falhas, mesmo com a senha certa', async () => {
    const limitedApp = createApp();
    const user = await createTestUser();

    for (let attempt = 1; attempt <= 10; attempt++) {
      const res = await request(limitedApp)
        .post('/api/auth/login')
        .send({ email: user.email, password: 'senha-errada-123' });
      expect(res.status).toBe(401);
    }

    const blocked = await request(limitedApp)
      .post('/api/auth/login')
      .send({ email: user.email, password: user.password });

    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('TOO_MANY_REQUESTS');
  });

  it('não conta logins bem-sucedidos', async () => {
    const limitedApp = createApp();
    const user = await createTestUser();

    for (let attempt = 1; attempt <= 12; attempt++) {
      const res = await request(limitedApp)
        .post('/api/auth/login')
        .send({ email: user.email, password: user.password });
      expect(res.status).toBe(200);
    }
  });
});

describe('applyNewPassword', () => {
  it('troca a senha, encerra as sessões e registra na auditoria', async () => {
    const user = await createTestUser();
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ email: user.email, password: user.password });

    const passwordHash = await hashPassword('senha-nova-segura-1');
    await db.transaction((tx) =>
      applyNewPassword(tx, { userId: user.id, passwordHash, actorUserId: null, via: 'cli' }),
    );

    // A sessão aberta com a senha antiga deixou de valer.
    expect((await agent.get('/api/auth/me')).status).toBe(401);
    expect(await db.select().from(sessions)).toHaveLength(0);

    const oldPassword = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: user.password });
    expect(oldPassword.status).toBe(401);

    const newPassword = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: 'senha-nova-segura-1' });
    expect(newPassword.status).toBe(200);

    const [entry] = await db.select().from(auditLog).where(eq(auditLog.action, 'password_reset'));
    expect(entry).toMatchObject({ userId: null, entityId: user.id, changes: { via: 'cli' } });
  });
});
