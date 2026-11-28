import { and, eq } from 'drizzle-orm';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import { db } from '../../database/client.js';
import { auditLog } from '../../database/schema/index.js';
import { loginAsTestUser } from '../../test/auth.js';
import { resetDatabase } from '../../test/db.js';

const app = createApp();

const flour = {
  name: 'Farinha de trigo',
  kind: 'ingredient',
  unit: 'g',
  packageQuantity: 1000,
  packagePriceCents: 650,
} as const;

const cakeBox = {
  name: 'Caixa de bolo 20cm',
  kind: 'packaging',
  unit: 'un',
  packageQuantity: 10,
  packagePriceCents: 2500,
} as const;

beforeEach(async () => {
  await resetDatabase();
});

describe('autenticação', () => {
  it('recusa todas as rotas sem sessão (401)', async () => {
    const responses = await Promise.all([
      request(app).get('/api/supplies'),
      request(app).get('/api/supplies/1'),
      request(app).post('/api/supplies').send(flour),
      request(app).patch('/api/supplies/1').send({ name: 'x' }),
    ]);

    for (const res of responses) {
      expect(res.status).toBe(401);
    }
  });
});

describe('POST /api/supplies', () => {
  it('cria o insumo e devolve o custo por unidade-base calculado', async () => {
    const { agent } = await loginAsTestUser(app);

    const res = await agent.post('/api/supplies').send({ ...flour, notes: '  Marca X  ' });

    expect(res.status).toBe(201);
    expect(res.body.supply).toMatchObject({
      ...flour,
      unitCostCents: 0.65, // R$ 6,50 ÷ 1000 g
      notes: 'Marca X',
      isActive: true,
    });
    expect(res.body.supply.id).toEqual(expect.any(Number));
  });

  it('grava a criação na auditoria, com a autora', async () => {
    const { agent, user } = await loginAsTestUser(app);

    const res = await agent.post('/api/supplies').send(flour);

    const entries = await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.entityType, 'supply'), eq(auditLog.entityId, res.body.supply.id)));
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ userId: user.id, action: 'create' });
  });

  it('recusa nome repetido, mesmo com maiúsculas e espaços diferentes (409)', async () => {
    const { agent } = await loginAsTestUser(app);
    await agent.post('/api/supplies').send(flour);

    const res = await agent.post('/api/supplies').send({ ...flour, name: '  FARINHA DE TRIGO ' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('SUPPLY_NAME_TAKEN');
  });

  it.each([
    ['nome vazio', { name: '   ' }, 'name'],
    ['tipo desconhecido', { kind: 'tool' }, 'kind'],
    ['unidade desconhecida', { unit: 'kg' }, 'unit'],
    ['quantidade zero', { packageQuantity: 0 }, 'packageQuantity'],
    ['quantidade fracionada', { packageQuantity: 1.5 }, 'packageQuantity'],
    ['preço em reais em vez de centavos', { packagePriceCents: 6.5 }, 'packagePriceCents'],
    ['preço negativo', { packagePriceCents: -1 }, 'packagePriceCents'],
    ['preço como texto', { packagePriceCents: '650' }, 'packagePriceCents'],
  ])('recusa %s (422)', async (_case, override, field) => {
    const { agent } = await loginAsTestUser(app);

    const res = await agent.post('/api/supplies').send({ ...flour, ...override });

    expect(res.status).toBe(422);
    expect(res.body.error.details[0].field).toBe(field);
  });
});

describe('GET /api/supplies', () => {
  it('lista só os ativos por padrão, em ordem alfabética', async () => {
    const { agent } = await loginAsTestUser(app);
    const created = await agent.post('/api/supplies').send(flour);
    await agent.post('/api/supplies').send(cakeBox);
    await agent.post('/api/supplies').send({ ...flour, name: 'Açúcar refinado' });
    await agent.patch(`/api/supplies/${created.body.supply.id}`).send({ isActive: false });

    const res = await agent.get('/api/supplies');

    expect(res.status).toBe(200);
    expect(res.body.supplies.map((s: { name: string }) => s.name)).toEqual([
      'Açúcar refinado',
      'Caixa de bolo 20cm',
    ]);
  });

  it('filtra por tipo e por situação', async () => {
    const { agent } = await loginAsTestUser(app);
    const created = await agent.post('/api/supplies').send(flour);
    await agent.post('/api/supplies').send(cakeBox);
    await agent.patch(`/api/supplies/${created.body.supply.id}`).send({ isActive: false });

    const packaging = await agent.get('/api/supplies?kind=packaging');
    const archived = await agent.get('/api/supplies?status=archived');
    const all = await agent.get('/api/supplies?status=all');

    expect(packaging.body.supplies.map((s: { name: string }) => s.name)).toEqual([cakeBox.name]);
    expect(archived.body.supplies.map((s: { name: string }) => s.name)).toEqual([flour.name]);
    expect(all.body.supplies).toHaveLength(2);
  });

  it('recusa filtro inválido (422)', async () => {
    const { agent } = await loginAsTestUser(app);

    const res = await agent.get('/api/supplies?status=deleted');

    expect(res.status).toBe(422);
  });
});

describe('GET /api/supplies/:id', () => {
  it('devolve o insumo', async () => {
    const { agent } = await loginAsTestUser(app);
    const created = await agent.post('/api/supplies').send(cakeBox);

    const res = await agent.get(`/api/supplies/${created.body.supply.id}`);

    expect(res.status).toBe(200);
    expect(res.body.supply).toMatchObject({ ...cakeBox, unitCostCents: 250 });
  });

  it.each(['999', 'abc', '-1'])('responde 404 para o id "%s"', async (id) => {
    const { agent } = await loginAsTestUser(app);

    const res = await agent.get(`/api/supplies/${id}`);

    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/supplies/:id', () => {
  it('altera só os campos enviados e recalcula o custo', async () => {
    const { agent } = await loginAsTestUser(app);
    const created = await agent.post('/api/supplies').send(flour);

    const res = await agent.patch(`/api/supplies/${created.body.supply.id}`).send({ packagePriceCents: 790 });

    expect(res.status).toBe(200);
    expect(res.body.supply).toMatchObject({ ...flour, packagePriceCents: 790, unitCostCents: 0.79 });
  });

  it('audita só o que mudou, com o valor antes e depois', async () => {
    const { agent, user } = await loginAsTestUser(app);
    const created = await agent.post('/api/supplies').send(flour);
    const id = created.body.supply.id;

    // O nome é o mesmo: só o preço deve aparecer na auditoria.
    await agent.patch(`/api/supplies/${id}`).send({ name: flour.name, packagePriceCents: 790 });

    const [entry] = await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.entityId, id), eq(auditLog.action, 'update')));
    expect(entry).toMatchObject({
      userId: user.id,
      changes: { packagePriceCents: { from: 650, to: 790 } },
    });
  });

  it('não grava nem audita quando nada mudou', async () => {
    const { agent } = await loginAsTestUser(app);
    const created = await agent.post('/api/supplies').send(flour);
    const id = created.body.supply.id;

    const res = await agent.patch(`/api/supplies/${id}`).send({ packageQuantity: 1000 });

    expect(res.status).toBe(200);
    expect(res.body.supply.updatedAt).toBe(created.body.supply.updatedAt);
    const updates = await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.entityId, id), eq(auditLog.action, 'update')));
    expect(updates).toHaveLength(0);
  });

  it('permite mudar só as maiúsculas do próprio nome', async () => {
    const { agent } = await loginAsTestUser(app);
    const created = await agent.post('/api/supplies').send(flour);

    const res = await agent
      .patch(`/api/supplies/${created.body.supply.id}`)
      .send({ name: 'FARINHA DE TRIGO' });

    expect(res.status).toBe(200);
    expect(res.body.supply.name).toBe('FARINHA DE TRIGO');
  });

  it('recusa renomear para o nome de outro insumo (409)', async () => {
    const { agent } = await loginAsTestUser(app);
    await agent.post('/api/supplies').send(flour);
    const box = await agent.post('/api/supplies').send(cakeBox);

    const res = await agent.patch(`/api/supplies/${box.body.supply.id}`).send({ name: 'farinha de trigo' });

    expect(res.status).toBe(409);
  });

  it('arquiva e reativa', async () => {
    const { agent } = await loginAsTestUser(app);
    const created = await agent.post('/api/supplies').send(flour);
    const id = created.body.supply.id;

    const archived = await agent.patch(`/api/supplies/${id}`).send({ isActive: false });
    const reactivated = await agent.patch(`/api/supplies/${id}`).send({ isActive: true });

    expect(archived.body.supply.isActive).toBe(false);
    expect(reactivated.body.supply.isActive).toBe(true);
  });

  it('recusa corpo vazio (422) e id desconhecido (404)', async () => {
    const { agent } = await loginAsTestUser(app);

    const empty = await agent.patch('/api/supplies/1').send({});
    const unknown = await agent.patch('/api/supplies/999').send({ name: 'Qualquer' });

    expect(empty.status).toBe(422);
    expect(unknown.status).toBe(404);
  });
});
