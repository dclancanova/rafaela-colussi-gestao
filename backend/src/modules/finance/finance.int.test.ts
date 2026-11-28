import { and, eq } from 'drizzle-orm';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import { db } from '../../database/client.js';
import { auditLog, financeTransactions } from '../../database/schema/index.js';
import { todayInBusinessTimeZone } from '../../shared/dates.js';
import { loginAsTestUser } from '../../test/auth.js';
import { resetDatabase } from '../../test/db.js';

const app = createApp();

type Agent = Awaited<ReturnType<typeof loginAsTestUser>>['agent'];

beforeEach(async () => {
  await resetDatabase();
});

async function createCategories(agent: Agent) {
  const create = async (name: string, kind: 'income' | 'expense') =>
    (await agent.post('/api/finance/categories').send({ name, kind })).body.category.id as number;
  return {
    sales: await create('Vendas', 'income'),
    supplies: await create('Insumos', 'expense'),
    gas: await create('Gás', 'expense'),
  };
}

function sale(categoryId: number, overrides: object = {}) {
  return {
    kind: 'income',
    account: 'bank',
    categoryId,
    amountCents: 12000,
    occurredOn: '2026-11-10',
    description: 'Bolo de aniversário',
    ...overrides,
  };
}

function purchase(categoryId: number, overrides: object = {}) {
  return {
    kind: 'expense',
    account: 'cash',
    categoryId,
    amountCents: 4500,
    occurredOn: '2026-11-12',
    description: 'Mercado',
    ...overrides,
  };
}

describe('autenticação', () => {
  it('recusa as rotas sem sessão (401)', async () => {
    const responses = await Promise.all([
      request(app).get('/api/finance/balances'),
      request(app).get('/api/finance/movements'),
      request(app).get('/api/finance/categories'),
      request(app).post('/api/finance/transactions').send({}),
    ]);

    for (const res of responses) {
      expect(res.status).toBe(401);
    }
  });
});

describe('categorias', () => {
  it('cria, lista por tipo e recusa nome repetido', async () => {
    const { agent } = await loginAsTestUser(app);
    await createCategories(agent);

    const expenses = await agent.get('/api/finance/categories?kind=expense');
    const repeated = await agent.post('/api/finance/categories').send({ name: 'VENDAS', kind: 'income' });

    expect(expenses.body.categories.map((c: { name: string }) => c.name)).toEqual(['Gás', 'Insumos']);
    expect(repeated.status).toBe(409);
  });

  it('renomeia e arquiva, mas não muda o tipo', async () => {
    const { agent } = await loginAsTestUser(app);
    const { gas } = await createCategories(agent);

    const renamed = await agent.patch(`/api/finance/categories/${gas}`).send({ name: 'Gás de cozinha' });
    const archived = await agent.patch(`/api/finance/categories/${gas}`).send({ isActive: false });
    const kindChange = await agent.patch(`/api/finance/categories/${gas}`).send({ kind: 'income' });

    expect(renamed.body.category.name).toBe('Gás de cozinha');
    expect(archived.body.category.isActive).toBe(false);
    // "kind" não é aceito na alteração: sem outro campo, o corpo fica vazio.
    expect(kindChange.status).toBe(422);
  });
});

describe('lançamentos', () => {
  it('cria entrada e saída, e grava quem lançou na auditoria', async () => {
    const { agent, user } = await loginAsTestUser(app);
    const ids = await createCategories(agent);

    const income = await agent.post('/api/finance/transactions').send(sale(ids.sales));
    const expense = await agent.post('/api/finance/transactions').send(purchase(ids.supplies));

    expect(income.status).toBe(201);
    expect(income.body.transaction).toMatchObject({
      kind: 'income',
      amountCents: 12000,
      occurredOn: '2026-11-10',
    });
    expect(expense.status).toBe(201);
    const [entry] = await db
      .select()
      .from(auditLog)
      .where(
        and(
          eq(auditLog.entityType, 'finance_transaction'),
          eq(auditLog.entityId, income.body.transaction.id),
        ),
      );
    expect(entry).toMatchObject({ userId: user.id, action: 'create' });
  });

  it('recusa categoria do tipo errado, arquivada ou inexistente (422)', async () => {
    const { agent } = await loginAsTestUser(app);
    const ids = await createCategories(agent);
    await agent.patch(`/api/finance/categories/${ids.gas}`).send({ isActive: false });

    const wrongKind = await agent.post('/api/finance/transactions').send(sale(ids.supplies));
    const archived = await agent.post('/api/finance/transactions').send(purchase(ids.gas));
    const missing = await agent.post('/api/finance/transactions').send(purchase(999));

    expect(wrongKind.status).toBe(422);
    expect(wrongKind.body.error.message).toBe('Escolha uma categoria de entrada');
    expect(archived.status).toBe(422);
    expect(archived.body.error.message).toBe('Esta categoria está arquivada');
    expect(missing.status).toBe(422);
  });

  it('o banco também recusa categoria do tipo errado, mesmo sem passar pela API', async () => {
    const { agent } = await loginAsTestUser(app);
    const ids = await createCategories(agent);

    await expect(
      db.insert(financeTransactions).values({
        kind: 'income',
        account: 'bank',
        categoryId: ids.supplies, // categoria de saída
        amountCents: 100,
        occurredOn: '2026-11-10',
        description: 'Teste',
      }),
    ).rejects.toThrow();
  });

  it.each([
    ['valor zero', { amountCents: 0 }, 'amountCents'],
    ['valor em reais', { amountCents: 120.5 }, 'amountCents'],
    ['data inválida', { occurredOn: '2026-13-01' }, 'occurredOn'],
    ['data no formato brasileiro', { occurredOn: '10/11/2026' }, 'occurredOn'],
    ['sem descrição', { description: '  ' }, 'description'],
    ['conta desconhecida', { account: 'cofre' }, 'account'],
  ])('recusa %s (422)', async (_case, override, field) => {
    const { agent } = await loginAsTestUser(app);
    const ids = await createCategories(agent);

    const res = await agent.post('/api/finance/transactions').send(sale(ids.sales, override));

    expect(res.status).toBe(422);
    expect(res.body.error.details[0].field).toBe(field);
  });

  it('recusa data futura no fuso da confeitaria, e aceita hoje', async () => {
    const { agent } = await loginAsTestUser(app);
    const ids = await createCategories(agent);
    const today = todayInBusinessTimeZone();
    const tomorrow = new Date(`${today}T12:00:00Z`);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

    const future = await agent
      .post('/api/finance/transactions')
      .send(sale(ids.sales, { occurredOn: tomorrow.toISOString().slice(0, 10) }));
    const now = await agent.post('/api/finance/transactions').send(sale(ids.sales, { occurredOn: today }));

    expect(future.status).toBe(422);
    expect(future.body.error.details[0].message).toBe('A data não pode ser no futuro');
    expect(now.status).toBe(201);
  });

  it('edita e audita só o que mudou', async () => {
    const { agent } = await loginAsTestUser(app);
    const ids = await createCategories(agent);
    const created = (await agent.post('/api/finance/transactions').send(purchase(ids.supplies))).body
      .transaction;

    const res = await agent
      .patch(`/api/finance/transactions/${created.id}`)
      .send({ amountCents: 5000, categoryId: ids.supplies });

    expect(res.body.transaction.amountCents).toBe(5000);
    const [entry] = await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.entityId, created.id), eq(auditLog.action, 'update')));
    expect(entry!.changes).toEqual({ amountCents: { from: 4500, to: 5000 } });
  });

  it('recusa trocar o tipo sem trocar para uma categoria compatível (422)', async () => {
    const { agent } = await loginAsTestUser(app);
    const ids = await createCategories(agent);
    const created = (await agent.post('/api/finance/transactions').send(purchase(ids.supplies))).body
      .transaction;

    const res = await agent.patch(`/api/finance/transactions/${created.id}`).send({ kind: 'income' });

    expect(res.status).toBe(422);
  });

  it('mantém a categoria arquivada em lançamento antigo, ao editar outro campo', async () => {
    const { agent } = await loginAsTestUser(app);
    const ids = await createCategories(agent);
    const created = (await agent.post('/api/finance/transactions').send(purchase(ids.gas))).body.transaction;
    await agent.patch(`/api/finance/categories/${ids.gas}`).send({ isActive: false });

    const res = await agent
      .patch(`/api/finance/transactions/${created.id}`)
      .send({ kind: 'expense', categoryId: ids.gas, description: 'Botijão' });

    expect(res.status).toBe(200);
  });

  it('exclui e guarda o registro inteiro na auditoria', async () => {
    const { agent } = await loginAsTestUser(app);
    const ids = await createCategories(agent);
    const created = (await agent.post('/api/finance/transactions').send(purchase(ids.supplies))).body
      .transaction;

    const res = await agent.delete(`/api/finance/transactions/${created.id}`);
    const again = await agent.delete(`/api/finance/transactions/${created.id}`);

    expect(res.status).toBe(204);
    expect(again.status).toBe(404);
    const [entry] = await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.entityId, created.id), eq(auditLog.action, 'delete')));
    expect(entry!.changes).toMatchObject({ amountCents: 4500, description: 'Mercado' });
  });
});

describe('saldos', () => {
  it('soma entradas, saídas, transferências e ajustes por conta', async () => {
    const { agent } = await loginAsTestUser(app);
    const ids = await createCategories(agent);

    // Saldo inicial: R$ 100,00 no caixa e R$ 1.000,00 na conta.
    await agent
      .post('/api/finance/adjustments')
      .send({ account: 'cash', amountCents: 10000, occurredOn: '2026-11-01', reason: 'Saldo inicial' });
    await agent
      .post('/api/finance/adjustments')
      .send({ account: 'bank', amountCents: 100000, occurredOn: '2026-11-01', reason: 'Saldo inicial' });
    // Venda de R$ 120,00 no Pix e compra de R$ 45,00 em dinheiro.
    await agent.post('/api/finance/transactions').send(sale(ids.sales));
    await agent.post('/api/finance/transactions').send(purchase(ids.supplies));
    // Depósito de R$ 50,00 do caixa no banco.
    await agent
      .post('/api/finance/transfers')
      .send({ fromAccount: 'cash', toAccount: 'bank', amountCents: 5000, occurredOn: '2026-11-15' });
    // Contagem do caixa achou R$ 2,00 a menos.
    await agent
      .post('/api/finance/adjustments')
      .send({ account: 'cash', amountCents: -200, occurredOn: '2026-11-20', reason: 'Conferência do caixa' });

    const res = await agent.get('/api/finance/balances');

    // Caixa: 100 − 45 − 50 − 2 = 3,00 | Conta: 1000 + 120 + 50 = 1170,00
    expect(res.body.balances).toEqual({ cash: 300, bank: 117000, total: 117300 });
  });

  it('começa em zero', async () => {
    const { agent } = await loginAsTestUser(app);

    const res = await agent.get('/api/finance/balances');

    expect(res.body.balances).toEqual({ cash: 0, bank: 0, total: 0 });
  });

  it('recusa transferência para a mesma conta e ajuste zero (422)', async () => {
    const { agent } = await loginAsTestUser(app);

    const transfer = await agent
      .post('/api/finance/transfers')
      .send({ fromAccount: 'cash', toAccount: 'cash', amountCents: 100, occurredOn: '2026-11-15' });
    const adjustment = await agent
      .post('/api/finance/adjustments')
      .send({ account: 'cash', amountCents: 0, occurredOn: '2026-11-15', reason: 'x' });

    expect(transfer.status).toBe(422);
    expect(adjustment.status).toBe(422);
  });
});

describe('movimentos do mês', () => {
  it('lista tudo do mês, mais recente primeiro, com totais só de entradas e saídas', async () => {
    const { agent, user } = await loginAsTestUser(app);
    const ids = await createCategories(agent);
    await agent
      .post('/api/finance/adjustments')
      .send({ account: 'cash', amountCents: 10000, occurredOn: '2026-11-01', reason: 'Saldo inicial' });
    await agent.post('/api/finance/transactions').send(sale(ids.sales)); // dia 10
    await agent.post('/api/finance/transactions').send(purchase(ids.supplies)); // dia 12
    await agent
      .post('/api/finance/transfers')
      .send({ fromAccount: 'cash', toAccount: 'bank', amountCents: 5000, occurredOn: '2026-11-15' });
    // Outro mês: não aparece.
    await agent.post('/api/finance/transactions').send(sale(ids.sales, { occurredOn: '2026-10-31' }));

    const res = await agent.get('/api/finance/movements?month=2026-11');

    expect(
      res.body.movements.map((m: { type: string; occurredOn: string }) => [m.type, m.occurredOn]),
    ).toEqual([
      ['transfer', '2026-11-15'],
      ['expense', '2026-11-12'],
      ['income', '2026-11-10'],
      ['adjustment', '2026-11-01'],
    ]);
    expect(res.body.movements[2]).toMatchObject({
      category: { id: ids.sales, name: 'Vendas' },
      createdByName: user.name,
    });
    expect(res.body.movements[3].description).toBe('Saldo inicial');
    expect(res.body.totals).toEqual({ incomeCents: 12000, expenseCents: 4500, resultCents: 7500 });
  });

  it('recusa mês inválido (422)', async () => {
    const { agent } = await loginAsTestUser(app);

    const res = await agent.get('/api/finance/movements?month=2026-13');

    expect(res.status).toBe(422);
  });

  it('exclui transferência e ajuste', async () => {
    const { agent } = await loginAsTestUser(app);
    const transfer = await agent
      .post('/api/finance/transfers')
      .send({ fromAccount: 'cash', toAccount: 'bank', amountCents: 5000, occurredOn: '2026-11-15' });
    const adjustment = await agent
      .post('/api/finance/adjustments')
      .send({ account: 'cash', amountCents: 100, occurredOn: '2026-11-15', reason: 'Teste' });

    const deletedTransfer = await agent.delete(`/api/finance/transfers/${transfer.body.transfer.id}`);
    const deletedAdjustment = await agent.delete(`/api/finance/adjustments/${adjustment.body.adjustment.id}`);
    const balances = await agent.get('/api/finance/balances');

    expect(deletedTransfer.status).toBe(204);
    expect(deletedAdjustment.status).toBe(204);
    expect(balances.body.balances.total).toBe(0);
  });
});
