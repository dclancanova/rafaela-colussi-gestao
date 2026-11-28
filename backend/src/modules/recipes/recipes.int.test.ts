import { and, eq } from 'drizzle-orm';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import { db } from '../../database/client.js';
import { auditLog, recipeItems } from '../../database/schema/index.js';
import { loginAsTestUser } from '../../test/auth.js';
import { resetDatabase } from '../../test/db.js';

const app = createApp();

type Agent = Awaited<ReturnType<typeof loginAsTestUser>>['agent'];

beforeEach(async () => {
  await resetDatabase();
});

/** Cadastra os insumos usados nos testes e devolve os ids. */
async function createSupplies(agent: Agent) {
  const create = async (body: object) =>
    (await agent.post('/api/supplies').send(body)).body.supply.id as number;
  return {
    // 395 g por R$ 7,90 → 2 centavos/g
    condensedMilk: await create({
      name: 'Leite condensado',
      kind: 'ingredient',
      unit: 'g',
      packageQuantity: 395,
      packagePriceCents: 790,
    }),
    // 1000 g por R$ 40,00 → 4 centavos/g
    chocolate: await create({
      name: 'Chocolate em pó',
      kind: 'ingredient',
      unit: 'g',
      packageQuantity: 1000,
      packagePriceCents: 4000,
    }),
    // 10 un por R$ 25,00 → 250 centavos/un
    box: await create({
      name: 'Caixa de bolo',
      kind: 'packaging',
      unit: 'un',
      packageQuantity: 10,
      packagePriceCents: 2500,
    }),
  };
}

/** Recheio de brigadeiro: 395 g de leite condensado + 100 g de chocolate = R$ 11,90; rende 500 g. */
function fillingBody(ids: Awaited<ReturnType<typeof createSupplies>>) {
  return {
    name: 'Recheio de brigadeiro',
    yieldQuantity: 500,
    yieldUnit: 'g',
    items: [
      { supplyId: ids.condensedMilk, quantity: 395 },
      { supplyId: ids.chocolate, quantity: 100 },
    ],
  };
}

describe('autenticação', () => {
  it('recusa todas as rotas sem sessão (401)', async () => {
    const responses = await Promise.all([
      request(app).get('/api/recipes'),
      request(app).get('/api/recipes/1'),
      request(app).post('/api/recipes').send({}),
      request(app).patch('/api/recipes/1').send({ name: 'x' }),
    ]);

    for (const res of responses) {
      expect(res.status).toBe(401);
    }
  });
});

describe('POST /api/recipes', () => {
  it('cria a ficha com os itens na ordem enviada e calcula o custo', async () => {
    const { agent } = await loginAsTestUser(app);
    const ids = await createSupplies(agent);

    const res = await agent.post('/api/recipes').send(fillingBody(ids));

    expect(res.status).toBe(201);
    expect(res.body.recipe).toMatchObject({
      name: 'Recheio de brigadeiro',
      yieldQuantity: 500,
      yieldUnit: 'g',
      itemCount: 2,
      totalCostCents: 1190,
      costPerYieldUnitCents: 2.38,
      usedIn: [],
    });
    expect(res.body.recipe.items).toEqual([
      expect.objectContaining({
        kind: 'supply',
        id: ids.condensedMilk,
        name: 'Leite condensado',
        unit: 'g',
        quantity: 395,
        costCents: 790,
      }),
      expect.objectContaining({ kind: 'supply', id: ids.chocolate, quantity: 100, costCents: 400 }),
    ]);
  });

  it('usa sub-receitas pelo custo por unidade do rendimento', async () => {
    const { agent } = await loginAsTestUser(app);
    const ids = await createSupplies(agent);
    const filling = (await agent.post('/api/recipes').send(fillingBody(ids))).body.recipe;

    const res = await agent.post('/api/recipes').send({
      name: 'Bolo de brigadeiro',
      yieldQuantity: 1,
      yieldUnit: 'un',
      items: [
        { recipeId: filling.id, quantity: 250 }, // 250 g × 2,38 = 595
        { supplyId: ids.box, quantity: 1 }, // 250
      ],
    });

    expect(res.status).toBe(201);
    expect(res.body.recipe.totalCostCents).toBe(845);
    expect(res.body.recipe.items[0]).toMatchObject({
      kind: 'recipe',
      id: filling.id,
      name: 'Recheio de brigadeiro',
      unit: 'g',
      costCents: 595,
    });
  });

  it('aceita quantidades com até 3 casas decimais', async () => {
    const { agent } = await loginAsTestUser(app);
    const ids = await createSupplies(agent);

    const res = await agent.post('/api/recipes').send({
      name: 'Teste decimais',
      yieldQuantity: 0.5,
      yieldUnit: 'un',
      items: [{ supplyId: ids.chocolate, quantity: 2.5 }],
    });

    expect(res.status).toBe(201);
    expect(res.body.recipe.yieldQuantity).toBe(0.5);
    expect(res.body.recipe.items[0].quantity).toBe(2.5);
    expect(res.body.recipe.totalCostCents).toBe(10); // 2,5 g × 4
  });

  it('grava a criação na auditoria com os itens', async () => {
    const { agent, user } = await loginAsTestUser(app);
    const ids = await createSupplies(agent);

    const res = await agent.post('/api/recipes').send(fillingBody(ids));

    const [entry] = await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.entityType, 'recipe'), eq(auditLog.entityId, res.body.recipe.id)));
    expect(entry).toMatchObject({ userId: user.id, action: 'create' });
    expect((entry!.changes as { items: unknown[] }).items).toHaveLength(2);
  });

  it('recusa nome repetido sem diferenciar maiúsculas (409)', async () => {
    const { agent } = await loginAsTestUser(app);
    const ids = await createSupplies(agent);
    await agent.post('/api/recipes').send(fillingBody(ids));

    const res = await agent.post('/api/recipes').send({ ...fillingBody(ids), name: 'RECHEIO DE BRIGADEIRO' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('RECIPE_NAME_TAKEN');
  });

  it.each([
    ['sem itens', { items: [] }, 'items'],
    ['rendimento zero', { yieldQuantity: 0 }, 'yieldQuantity'],
    ['unidade desconhecida', { yieldUnit: 'kg' }, 'yieldUnit'],
    ['item sem insumo nem ficha', { items: [{ quantity: 1 }] }, 'items.0'],
    ['item com insumo e ficha', { items: [{ supplyId: 1, recipeId: 1, quantity: 1 }] }, 'items.0'],
    ['quantidade negativa', { items: [{ supplyId: 1, quantity: -1 }] }, 'items.0.quantity'],
  ])('recusa %s (422)', async (_case, override, field) => {
    const { agent } = await loginAsTestUser(app);
    const ids = await createSupplies(agent);

    const res = await agent.post('/api/recipes').send({ ...fillingBody(ids), ...override });

    expect(res.status).toBe(422);
    expect(res.body.error.details[0].field).toBe(field);
  });

  it('recusa item repetido, insumo inexistente e ficha inexistente (422)', async () => {
    const { agent } = await loginAsTestUser(app);
    const ids = await createSupplies(agent);
    const base = fillingBody(ids);

    const repeated = await agent.post('/api/recipes').send({
      ...base,
      items: [
        { supplyId: ids.chocolate, quantity: 1 },
        { supplyId: ids.chocolate, quantity: 2 },
      ],
    });
    const missingSupply = await agent
      .post('/api/recipes')
      .send({ ...base, items: [{ supplyId: 999, quantity: 1 }] });
    const missingRecipe = await agent
      .post('/api/recipes')
      .send({ ...base, items: [{ recipeId: 999, quantity: 1 }] });

    expect(repeated.status).toBe(422);
    expect(repeated.body.error.details[0].field).toBe('items.1');
    expect(missingSupply.status).toBe(422);
    expect(missingRecipe.status).toBe(422);
  });
});

describe('GET /api/recipes', () => {
  it('lista ativas por padrão, em ordem alfabética, com custos', async () => {
    const { agent } = await loginAsTestUser(app);
    const ids = await createSupplies(agent);
    await agent.post('/api/recipes').send(fillingBody(ids));
    const archived = await agent.post('/api/recipes').send({
      name: 'Antiga',
      yieldQuantity: 1,
      yieldUnit: 'un',
      items: [{ supplyId: ids.box, quantity: 1 }],
    });
    await agent.patch(`/api/recipes/${archived.body.recipe.id}`).send({ isActive: false });

    const active = await agent.get('/api/recipes');
    const all = await agent.get('/api/recipes?status=all');

    expect(active.body.recipes.map((r: { name: string }) => r.name)).toEqual(['Recheio de brigadeiro']);
    expect(active.body.recipes[0]).toMatchObject({ totalCostCents: 1190, itemCount: 2 });
    expect(all.body.recipes.map((r: { name: string }) => r.name)).toEqual([
      'Antiga',
      'Recheio de brigadeiro',
    ]);
  });
});

describe('GET /api/recipes/:id', () => {
  it('mostra em quais fichas ela é usada', async () => {
    const { agent } = await loginAsTestUser(app);
    const ids = await createSupplies(agent);
    const filling = (await agent.post('/api/recipes').send(fillingBody(ids))).body.recipe;
    const cake = (
      await agent.post('/api/recipes').send({
        name: 'Bolo',
        yieldQuantity: 1,
        yieldUnit: 'un',
        items: [{ recipeId: filling.id, quantity: 250 }],
      })
    ).body.recipe;

    const res = await agent.get(`/api/recipes/${filling.id}`);

    expect(res.body.recipe.usedIn).toEqual([{ id: cake.id, name: 'Bolo' }]);
  });

  it.each(['999', 'abc'])('responde 404 para o id "%s"', async (id) => {
    const { agent } = await loginAsTestUser(app);

    const res = await agent.get(`/api/recipes/${id}`);

    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/recipes/:id', () => {
  it('substitui a lista de itens e recalcula', async () => {
    const { agent } = await loginAsTestUser(app);
    const ids = await createSupplies(agent);
    const filling = (await agent.post('/api/recipes').send(fillingBody(ids))).body.recipe;

    const res = await agent
      .patch(`/api/recipes/${filling.id}`)
      .send({ items: [{ supplyId: ids.condensedMilk, quantity: 790 }] });

    expect(res.status).toBe(200);
    expect(res.body.recipe.items).toHaveLength(1);
    expect(res.body.recipe.totalCostCents).toBe(1580);
    const stored = await db.select().from(recipeItems).where(eq(recipeItems.recipeId, filling.id));
    expect(stored).toHaveLength(1);
  });

  it('o custo de quem usa a sub-receita acompanha o preço do insumo', async () => {
    const { agent } = await loginAsTestUser(app);
    const ids = await createSupplies(agent);
    const filling = (await agent.post('/api/recipes').send(fillingBody(ids))).body.recipe;
    const cake = (
      await agent.post('/api/recipes').send({
        name: 'Bolo',
        yieldQuantity: 1,
        yieldUnit: 'un',
        items: [{ recipeId: filling.id, quantity: 500 }],
      })
    ).body.recipe;
    expect(cake.totalCostCents).toBe(1190);

    // Chocolate passa de R$ 40,00 para R$ 60,00 o kg: o recheio sobe 200 centavos.
    await agent.patch(`/api/supplies/${ids.chocolate}`).send({ packagePriceCents: 6000 });

    const res = await agent.get(`/api/recipes/${cake.id}`);
    expect(res.body.recipe.totalCostCents).toBe(1390);
  });

  it('audita campos e itens só quando mudam', async () => {
    const { agent } = await loginAsTestUser(app);
    const ids = await createSupplies(agent);
    const body = fillingBody(ids);
    const filling = (await agent.post('/api/recipes').send(body)).body.recipe;

    // Mesmos itens, mesmo nome: nada muda.
    await agent.patch(`/api/recipes/${filling.id}`).send({ name: body.name, items: body.items });
    // Só o rendimento muda.
    await agent.patch(`/api/recipes/${filling.id}`).send({ items: body.items, yieldQuantity: 600 });

    const updates = await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.entityId, filling.id), eq(auditLog.action, 'update')));
    expect(updates).toHaveLength(1);
    expect(updates[0]!.changes).toEqual({ yieldQuantity: { from: 500, to: 600 } });
  });

  it('recusa ciclos direto e indireto (422)', async () => {
    const { agent } = await loginAsTestUser(app);
    const ids = await createSupplies(agent);
    const base = (await agent.post('/api/recipes').send(fillingBody(ids))).body.recipe;
    const middle = (
      await agent.post('/api/recipes').send({
        name: 'Meio',
        yieldQuantity: 1,
        yieldUnit: 'un',
        items: [{ recipeId: base.id, quantity: 100 }],
      })
    ).body.recipe;
    const top = (
      await agent.post('/api/recipes').send({
        name: 'Topo',
        yieldQuantity: 1,
        yieldUnit: 'un',
        items: [{ recipeId: middle.id, quantity: 1 }],
      })
    ).body.recipe;

    const self = await agent
      .patch(`/api/recipes/${base.id}`)
      .send({ items: [{ recipeId: base.id, quantity: 1 }] });
    const direct = await agent
      .patch(`/api/recipes/${base.id}`)
      .send({ items: [{ recipeId: middle.id, quantity: 1 }] });
    const indirect = await agent
      .patch(`/api/recipes/${base.id}`)
      .send({ items: [{ recipeId: top.id, quantity: 1 }] });

    expect(self.status).toBe(422);
    expect(direct.status).toBe(422);
    expect(indirect.status).toBe(422);
    expect(indirect.body.error.message).toContain('"Topo" já usa esta ficha técnica');
  });

  it('recusa trocar a unidade do rendimento de uma ficha usada em outra (409)', async () => {
    const { agent } = await loginAsTestUser(app);
    const ids = await createSupplies(agent);
    const filling = (await agent.post('/api/recipes').send(fillingBody(ids))).body.recipe;
    await agent.post('/api/recipes').send({
      name: 'Bolo',
      yieldQuantity: 1,
      yieldUnit: 'un',
      items: [{ recipeId: filling.id, quantity: 250 }],
    });

    const res = await agent.patch(`/api/recipes/${filling.id}`).send({ yieldUnit: 'un' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('RECIPE_IN_USE');
  });

  it('arquiva sem tirar o custo de quem a usa', async () => {
    const { agent } = await loginAsTestUser(app);
    const ids = await createSupplies(agent);
    const filling = (await agent.post('/api/recipes').send(fillingBody(ids))).body.recipe;
    const cake = (
      await agent.post('/api/recipes').send({
        name: 'Bolo',
        yieldQuantity: 1,
        yieldUnit: 'un',
        items: [{ recipeId: filling.id, quantity: 500 }],
      })
    ).body.recipe;

    await agent.patch(`/api/recipes/${filling.id}`).send({ isActive: false });

    const res = await agent.get(`/api/recipes/${cake.id}`);
    expect(res.body.recipe.totalCostCents).toBe(1190);
    expect(res.body.recipe.items[0].isActive).toBe(false);
  });
});

describe('insumo usado em ficha técnica', () => {
  it('recusa trocar a unidade (409), mas aceita trocar o preço', async () => {
    const { agent } = await loginAsTestUser(app);
    const ids = await createSupplies(agent);
    await agent.post('/api/recipes').send(fillingBody(ids));

    const unit = await agent.patch(`/api/supplies/${ids.chocolate}`).send({ unit: 'un' });
    const price = await agent.patch(`/api/supplies/${ids.chocolate}`).send({ packagePriceCents: 4500 });

    expect(unit.status).toBe(409);
    expect(unit.body.error.code).toBe('SUPPLY_IN_USE');
    expect(unit.body.error.message).toContain('Recheio de brigadeiro');
    expect(price.status).toBe(200);
  });

  it('aceita trocar a unidade de insumo que nenhuma ficha usa', async () => {
    const { agent } = await loginAsTestUser(app);
    const ids = await createSupplies(agent);

    const res = await agent.patch(`/api/supplies/${ids.box}`).send({ unit: 'g' });

    expect(res.status).toBe(200);
  });
});
