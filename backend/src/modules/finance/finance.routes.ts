import { Router } from 'express';
import { z } from 'zod';
import { todayInBusinessTimeZone } from '../../shared/dates.js';
import { parseIdParam } from '../../shared/route-params.js';
import { getAuth, requireAuth } from '../auth/auth.middleware.js';
import { ENTRY_KINDS } from './categories.service.js';
import {
  ACCOUNTS,
  createAdjustment,
  createTransaction,
  createTransfer,
  deleteAdjustment,
  deleteTransaction,
  deleteTransfer,
  getBalances,
  getTransaction,
  listMovements,
  updateTransaction,
} from './finance.service.js';

const MAX_AMOUNT_CENTS = 100_000_000; // R$ 1.000.000,00: barra erro de digitação (zeros a mais)

const accountSchema = z.enum(ACCOUNTS, { error: 'Escolha Caixa ou Conta' });

const amountSchema = z
  .number({ error: 'Informe o valor' })
  .int('O valor deve estar em centavos inteiros')
  .positive('O valor deve ser maior que zero')
  .max(MAX_AMOUNT_CENTS, 'Valor alto demais');

// Decisão AZ: só o que já aconteceu, então a data não pode ser futura (no fuso da confeitaria, decisão BA).
// A comparação de texto funciona porque o formato AAAA-MM-DD ordena igual às datas.
const occurredOnSchema = z.iso
  .date({ error: 'Data inválida' })
  .refine((value) => value >= '2000-01-01', 'Data inválida')
  .refine((value) => value <= todayInBusinessTimeZone(), 'A data não pode ser no futuro');

const textSchema = (label: string, max: number) =>
  z
    .string({ error: `Informe ${label}` })
    .trim()
    .min(1, `Informe ${label}`)
    .max(max, 'Texto longo demais');

const transactionFields = {
  kind: z.enum(ENTRY_KINDS, { error: 'Escolha entrada ou saída' }),
  account: accountSchema,
  categoryId: z.number({ error: 'Escolha a categoria' }).int().positive('Escolha a categoria'),
  amountCents: amountSchema,
  occurredOn: occurredOnSchema,
  description: textSchema('a descrição', 200),
};

const createTransactionSchema = z.object(transactionFields);

const updateTransactionSchema = z
  .object(transactionFields)
  .partial()
  .refine((changes) => Object.values(changes).some((value) => value !== undefined), {
    message: 'Nada para alterar',
  });

const transferSchema = z
  .object({
    fromAccount: accountSchema,
    toAccount: accountSchema,
    amountCents: amountSchema,
    occurredOn: occurredOnSchema,
    description: z
      .string()
      .trim()
      .max(200, 'Texto longo demais')
      .nullable()
      .transform((value) => (value === '' ? null : value))
      .optional(),
  })
  .refine((transfer) => transfer.fromAccount !== transfer.toAccount, {
    message: 'Origem e destino precisam ser diferentes',
    path: ['toAccount'],
  });

const adjustmentSchema = z.object({
  account: accountSchema,
  // Com sinal: positivo aumenta o saldo, negativo diminui (decisão BC).
  amountCents: z
    .number({ error: 'Informe o valor' })
    .int('O valor deve estar em centavos inteiros')
    .refine((value) => value !== 0, 'O ajuste não pode ser zero')
    .refine((value) => Math.abs(value) <= MAX_AMOUNT_CENTS, 'Valor alto demais'),
  occurredOn: occurredOnSchema,
  reason: textSchema('o motivo', 200),
});

const monthQuerySchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Mês inválido (use AAAA-MM)')
    .optional(),
});

export const financeRouter = Router();

financeRouter.use(requireAuth);

financeRouter.get('/balances', async (_req, res) => {
  res.json({ balances: await getBalances() });
});

financeRouter.get('/movements', async (req, res) => {
  const { month } = monthQuerySchema.parse(req.query);
  // Sem mês na URL: o mês atual no fuso da confeitaria.
  res.json(await listMovements(month ?? todayInBusinessTimeZone().slice(0, 7)));
});

financeRouter.get('/transactions/:id', async (req, res) => {
  res.json({ transaction: await getTransaction(parseIdParam(req.params.id, 'Lançamento não encontrado')) });
});

financeRouter.post('/transactions', async (req, res) => {
  const input = createTransactionSchema.parse(req.body ?? {});
  res.status(201).json({ transaction: await createTransaction(input, getAuth(req).user.id) });
});

financeRouter.patch('/transactions/:id', async (req, res) => {
  const id = parseIdParam(req.params.id, 'Lançamento não encontrado');
  const changes = updateTransactionSchema.parse(req.body ?? {});
  res.json({ transaction: await updateTransaction(id, changes, getAuth(req).user.id) });
});

financeRouter.delete('/transactions/:id', async (req, res) => {
  await deleteTransaction(parseIdParam(req.params.id, 'Lançamento não encontrado'), getAuth(req).user.id);
  res.status(204).end();
});

financeRouter.post('/transfers', async (req, res) => {
  const input = transferSchema.parse(req.body ?? {});
  res.status(201).json({ transfer: await createTransfer(input, getAuth(req).user.id) });
});

financeRouter.delete('/transfers/:id', async (req, res) => {
  await deleteTransfer(parseIdParam(req.params.id, 'Transferência não encontrada'), getAuth(req).user.id);
  res.status(204).end();
});

financeRouter.post('/adjustments', async (req, res) => {
  const input = adjustmentSchema.parse(req.body ?? {});
  res.status(201).json({ adjustment: await createAdjustment(input, getAuth(req).user.id) });
});

financeRouter.delete('/adjustments/:id', async (req, res) => {
  await deleteAdjustment(parseIdParam(req.params.id, 'Ajuste não encontrado'), getAuth(req).user.id);
  res.status(204).end();
});
