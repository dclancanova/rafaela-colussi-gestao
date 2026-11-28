import { and, eq } from 'drizzle-orm';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import { db } from '../../database/client.js';
import { auditLog } from '../../database/schema/index.js';
import { loginAsTestUser } from '../../test/auth.js';
import { resetDatabase } from '../../test/db.js';

const app = createApp();

type Agent = Awaited<ReturnType<typeof loginAsTestUser>>['agent'];

beforeEach(async () => {
  await resetDatabase();
});

/**
 * Ficha "Brigadeiro": 395 g de leite condensado (R$ 7,90) + 100 g de chocolate (R$ 4,00)
 * = R$ 11,90, rende 50 un → 23,8 centavos por brigadeiro.
 */
async function createBrigadeiroRecipe(agent: Agent) {
  const supply = async (body: object) =>
    (await agent.post('/api/supplies').send(body)).body.supply.id as number;
  const milk = await supply({
    name: 'Leite condensado',
    kind: 'ingredient',
    unit: 'g',
    packageQuantity: 395,
    packagePriceCents: 790,
  });
  const chocolate = await supply({
    name: 'Chocolate em pó',
    kind: 'ingredient',
    unit: 'g',
    packageQuantity: 1000,
    packagePriceCents: 4000,
  });
  const res = await agent.post('/api/recipes').send({
    name: 'Brigadeiro',
    yieldQuantity: 50,
    yieldUnit: 'un',
    items: [
      { supplyId: milk, quantity: 395 },
      { supplyId: chocolate, quantity: 100 },
    ],
  });
  return { recipeId: res.body.recipe.id as number, milk, chocolate };
}

/** Cento de brigadeiros: 100 un da ficha = R$ 23,80 de custo direto. */
const cento = (recipeId: number) => ({
  name: 'Cento de brigadeiros',
  recipeId,
  recipeQuantity: 100,
  priceCents: 12000,
});

describe('autenticação', () => {
  it('recusa as rotas sem sessão (401)', async () => {
    const responses = await Promise.all([
      request(app).get('/api/products'),
      request(app).post('/api/products').send({}),
      request(app).get('/api/settings/pricing'),
      request(app).patch('/api/settings/pricing').send({ indirectCostBasisPoints: 1 }),
    ]);

    for (const res of responses) {
      expect(res.status).toBe(401);
    }
  });
});

describe('POST /api/products', () => {
  it('cria o produto com custo, lucro, margem e preço sugerido (configuração padrão)', async () => {
    const { agent } = await loginAsTestUser(app);
    const { recipeId } = await createBrigadeiroRecipe(agent);

    const res = await agent.post('/api/products').send(cento(recipeId));

    expect(res.status).toBe(201);
    expect(res.body.product).toMatchObject({
      name: 'Cento de brigadeiros',
      recipe: { id: recipeId, name: 'Brigadeiro', yieldUnit: 'un', isActive: true },
      recipeQuantity: 100,
      priceCents: 12000,
      directCostCents: 2380,
      indirectCostCents: 0, // padrão: 0% de indiretos
      totalCostCents: 2380,
      profitCents: 9620,
      suggestedPriceCents: 5950, // padrão: meta de 60% → 23,80 ÷ 0,4
    });
    expect(res.body.product.marginRatio).toBeCloseTo(0.8017, 4);
  });

  it('audita a criação', async () => {
    const { agent, user } = await loginAsTestUser(app);
    const { recipeId } = await createBrigadeiroRecipe(agent);

    const res = await agent.post('/api/products').send(cento(recipeId));

    const [entry] = await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.entityType, 'product'), eq(auditLog.entityId, res.body.product.id)));
    expect(entry).toMatchObject({ userId: user.id, action: 'create' });
  });

  it('recusa nome repetido (409) e ficha inexistente (422)', async () => {
    const { agent } = await loginAsTestUser(app);
    const { recipeId } = await createBrigadeiroRecipe(agent);
    await agent.post('/api/products').send(cento(recipeId));

    const repeated = await agent
      .post('/api/products')
      .send({ ...cento(recipeId), name: 'CENTO DE BRIGADEIROS' });
    const missing = await agent.post('/api/products').send({ ...cento(999), name: 'Outro' });

    expect(repeated.status).toBe(409);
    expect(repeated.body.error.code).toBe('PRODUCT_NAME_TAKEN');
    expect(missing.status).toBe(422);
    expect(missing.body.error.details[0].field).toBe('recipeId');
  });

  it.each([
    ['preço em reais', { priceCents: 120.5 }, 'priceCents'],
    ['preço negativo', { priceCents: -1 }, 'priceCents'],
    ['quantidade zero', { recipeQuantity: 0 }, 'recipeQuantity'],
    ['sem ficha', { recipeId: undefined }, 'recipeId'],
  ])('recusa %s (422)', async (_case, override, field) => {
    const { agent } = await loginAsTestUser(app);
    const { recipeId } = await createBrigadeiroRecipe(agent);

    const res = await agent.post('/api/products').send({ ...cento(recipeId), ...override });

    expect(res.status).toBe(422);
    expect(res.body.error.details[0].field).toBe(field);
  });
});

describe('preço e custo acompanham as mudanças', () => {
  it('usa a configuração de indiretos e margem-alvo', async () => {
    const { agent } = await loginAsTestUser(app, { role: 'admin' });
    const { recipeId } = await createBrigadeiroRecipe(agent);
    const product = (await agent.post('/api/products').send(cento(recipeId))).body.product;

    await agent
      .patch('/api/settings/pricing')
      .send({ indirectCostBasisPoints: 2000, targetMarginBasisPoints: 5000 });

    const res = await agent.get(`/api/products/${product.id}`);
    expect(res.body.product).toMatchObject({
      directCostCents: 2380,
      indirectCostCents: 476, // 20%
      totalCostCents: 2856,
      profitCents: 9144,
      suggestedPriceCents: 5712, // 28,56 ÷ 0,5
    });
  });

  it('o custo sobe quando o insumo da ficha sobe', async () => {
    const { agent } = await loginAsTestUser(app);
    const { recipeId, chocolate } = await createBrigadeiroRecipe(agent);
    const product = (await agent.post('/api/products').send(cento(recipeId))).body.product;

    // Chocolate de R$ 40 para R$ 60 o kg: a ficha sobe R$ 2,00 e o cento (2 fichas) sobe R$ 4,00.
    await agent.patch(`/api/supplies/${chocolate}`).send({ packagePriceCents: 6000 });

    const res = await agent.get(`/api/products/${product.id}`);
    expect(res.body.product.directCostCents).toBe(2780);
  });
});

describe('GET /api/products', () => {
  it('lista os ativos por padrão, em ordem alfabética', async () => {
    const { agent } = await loginAsTestUser(app);
    const { recipeId } = await createBrigadeiroRecipe(agent);
    await agent.post('/api/products').send(cento(recipeId));
    const half = await agent
      .post('/api/products')
      .send({ ...cento(recipeId), name: 'Meio cento', recipeQuantity: 50 });
    await agent.post('/api/products').send({ ...cento(recipeId), name: 'Caixa com 12', recipeQuantity: 12 });
    await agent.patch(`/api/products/${half.body.product.id}`).send({ isActive: false });

    const active = await agent.get('/api/products');
    const archived = await agent.get('/api/products?status=archived');

    expect(active.body.products.map((p: { name: string }) => p.name)).toEqual([
      'Caixa com 12',
      'Cento de brigadeiros',
    ]);
    expect(archived.body.products.map((p: { name: string }) => p.name)).toEqual(['Meio cento']);
  });
});

describe('PATCH /api/products/:id', () => {
  it('audita a mudança de preço com antes e depois', async () => {
    const { agent, user } = await loginAsTestUser(app);
    const { recipeId } = await createBrigadeiroRecipe(agent);
    const product = (await agent.post('/api/products').send(cento(recipeId))).body.product;

    const res = await agent
      .patch(`/api/products/${product.id}`)
      .send({ priceCents: 13000, name: product.name });

    expect(res.body.product.priceCents).toBe(13000);
    const [entry] = await db
      .select()
      .from(auditLog)
      .where(
        and(
          eq(auditLog.entityId, product.id),
          eq(auditLog.entityType, 'product'),
          eq(auditLog.action, 'update'),
        ),
      );
    expect(entry).toMatchObject({ userId: user.id, changes: { priceCents: { from: 12000, to: 13000 } } });
  });

  it('responde 404 para produto inexistente', async () => {
    const { agent } = await loginAsTestUser(app);

    const res = await agent.patch('/api/products/999').send({ priceCents: 100 });

    expect(res.status).toBe(404);
  });
});

describe('ficha usada em produto', () => {
  it('recusa trocar a unidade do rendimento (409)', async () => {
    const { agent } = await loginAsTestUser(app);
    const { recipeId } = await createBrigadeiroRecipe(agent);
    await agent.post('/api/products').send(cento(recipeId));

    const res = await agent.patch(`/api/recipes/${recipeId}`).send({ yieldUnit: 'g' });

    expect(res.status).toBe(409);
    expect(res.body.error.message).toContain('produto "Cento de brigadeiros"');
  });
});

describe('/api/settings/pricing', () => {
  it('devolve os valores padrão antes da primeira gravação', async () => {
    const { agent } = await loginAsTestUser(app);

    const res = await agent.get('/api/settings/pricing');

    expect(res.body.settings).toEqual({ indirectCostBasisPoints: 0, targetMarginBasisPoints: 6000 });
  });

  it('admin altera, e a auditoria guarda só o que mudou', async () => {
    const { agent, user } = await loginAsTestUser(app, { role: 'admin' });

    await agent.patch('/api/settings/pricing').send({ indirectCostBasisPoints: 1500 });
    const res = await agent.patch('/api/settings/pricing').send({ targetMarginBasisPoints: 5500 });

    expect(res.body.settings).toEqual({ indirectCostBasisPoints: 1500, targetMarginBasisPoints: 5500 });
    const entries = await db.select().from(auditLog).where(eq(auditLog.entityType, 'pricing_settings'));
    expect(entries.map((entry) => entry.changes)).toEqual([
      { indirectCostBasisPoints: { from: 0, to: 1500 } },
      { targetMarginBasisPoints: { from: 6000, to: 5500 } },
    ]);
    expect(entries[0]!.userId).toBe(user.id);
  });

  it('recusa quem não é admin (403)', async () => {
    const { agent } = await loginAsTestUser(app, { role: 'member' });

    const res = await agent.patch('/api/settings/pricing').send({ indirectCostBasisPoints: 1500 });

    expect(res.status).toBe(403);
  });

  it.each([
    ['margem de 100%', { targetMarginBasisPoints: 10_000 }],
    ['indiretos negativos', { indirectCostBasisPoints: -1 }],
    ['percentual com mais de 2 casas', { indirectCostBasisPoints: 1500.5 }],
    ['corpo vazio', {}],
  ])('recusa %s (422)', async (_case, body) => {
    const { agent } = await loginAsTestUser(app, { role: 'admin' });

    const res = await agent.patch('/api/settings/pricing').send(body);

    expect(res.status).toBe(422);
  });
});
