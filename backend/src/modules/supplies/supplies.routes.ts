import { Router } from 'express';
import { z } from 'zod';
import { NotFoundError } from '../../shared/errors.js';
import { getAuth, requireAuth } from '../auth/auth.middleware.js';
import {
  createSupply,
  getSupply,
  listSupplies,
  MEASUREMENT_UNITS,
  SUPPLY_KINDS,
  updateSupply,
} from './supplies.service.js';

// Limites altos o bastante para o uso real; existem para barrar erros de digitação (ex.: um zero a mais).
const MAX_PACKAGE_QUANTITY = 1_000_000; // 1 tonelada em gramas
const MAX_PRICE_CENTS = 10_000_000; // R$ 100.000,00

const supplyFields = {
  name: z.string().trim().min(1, 'Informe o nome').max(120, 'Nome longo demais'),
  kind: z.enum(SUPPLY_KINDS, { error: 'Escolha ingrediente ou embalagem' }),
  unit: z.enum(MEASUREMENT_UNITS, { error: 'Escolha a unidade: g, ml ou un' }),
  packageQuantity: z
    .number({ error: 'Informe a quantidade da embalagem' })
    .int('A quantidade deve ser um número inteiro')
    .positive('A quantidade deve ser maior que zero')
    .max(MAX_PACKAGE_QUANTITY, 'Quantidade grande demais'),
  packagePriceCents: z
    .number({ error: 'Informe o preço' })
    .int('O preço deve estar em centavos inteiros')
    .min(0, 'O preço não pode ser negativo')
    .max(MAX_PRICE_CENTS, 'Preço alto demais'),
  // Texto vazio vira null: "sem observação" tem um jeito só de ser guardado.
  notes: z
    .string()
    .trim()
    .max(1000, 'Observação longa demais')
    .nullable()
    .transform((value) => (value === '' ? null : value))
    .optional(),
};

const createSupplySchema = z.object(supplyFields);

const updateSupplySchema = z
  .object({ ...supplyFields, isActive: z.boolean({ error: 'Valor inválido' }) })
  .partial()
  .refine((changes) => Object.values(changes).some((value) => value !== undefined), {
    message: 'Nada para alterar',
  });

const listQuerySchema = z.object({
  kind: z.enum(SUPPLY_KINDS).optional(),
  status: z.enum(['active', 'archived', 'all']).default('active'),
});

/** "/api/supplies/abc" é um endereço que não existe: 404, como qualquer id desconhecido. */
function parseId(value: string | undefined): number {
  const parsed = z.coerce.number().int().positive().safeParse(value);
  if (!parsed.success) throw new NotFoundError('Insumo não encontrado');
  return parsed.data;
}

export const suppliesRouter = Router();

// Todas as rotas de insumos exigem sessão.
suppliesRouter.use(requireAuth);

suppliesRouter.get('/', async (req, res) => {
  const filter = listQuerySchema.parse(req.query);
  res.json({ supplies: await listSupplies(filter) });
});

suppliesRouter.get('/:id', async (req, res) => {
  res.json({ supply: await getSupply(parseId(req.params.id)) });
});

suppliesRouter.post('/', async (req, res) => {
  const input = createSupplySchema.parse(req.body ?? {});
  const supply = await createSupply(input, getAuth(req).user.id);
  res.status(201).json({ supply });
});

suppliesRouter.patch('/:id', async (req, res) => {
  const id = parseId(req.params.id);
  const changes = updateSupplySchema.parse(req.body ?? {});
  res.json({ supply: await updateSupply(id, changes, getAuth(req).user.id) });
});
