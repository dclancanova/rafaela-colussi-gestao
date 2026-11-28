import { Router } from 'express';
import { z } from 'zod';
import { parseIdParam } from '../../shared/route-params.js';
import { getAuth, requireAuth } from '../auth/auth.middleware.js';
import { createProduct, getProduct, listProducts, updateProduct } from './products.service.js';

const NOT_FOUND_MESSAGE = 'Produto não encontrado';
const MAX_PRICE_CENTS = 10_000_000; // R$ 100.000,00

const productFields = {
  name: z.string().trim().min(1, 'Informe o nome').max(120, 'Nome longo demais'),
  recipeId: z.number({ error: 'Escolha a ficha técnica' }).int().positive('Escolha a ficha técnica'),
  // Decisão AM: até 3 casas, arredondado antes de conferir.
  recipeQuantity: z
    .number({ error: 'Informe a quantidade da ficha' })
    .transform((value) => Math.round(value * 1000) / 1000)
    .pipe(
      z.number().positive('A quantidade deve ser maior que zero').max(1_000_000, 'Quantidade grande demais'),
    ),
  priceCents: z
    .number({ error: 'Informe o preço de venda' })
    .int('O preço deve estar em centavos inteiros')
    .min(0, 'O preço não pode ser negativo')
    .max(MAX_PRICE_CENTS, 'Preço alto demais'),
  notes: z
    .string()
    .trim()
    .max(1000, 'Observação longa demais')
    .nullable()
    .transform((value) => (value === '' ? null : value))
    .optional(),
};

const createProductSchema = z.object(productFields);

const updateProductSchema = z
  .object({ ...productFields, isActive: z.boolean({ error: 'Valor inválido' }) })
  .partial()
  .refine((changes) => Object.values(changes).some((value) => value !== undefined), {
    message: 'Nada para alterar',
  });

const listQuerySchema = z.object({
  status: z.enum(['active', 'archived', 'all']).default('active'),
});

export const productsRouter = Router();

productsRouter.use(requireAuth);

productsRouter.get('/', async (req, res) => {
  const filter = listQuerySchema.parse(req.query);
  res.json({ products: await listProducts(filter) });
});

productsRouter.get('/:id', async (req, res) => {
  res.json({ product: await getProduct(parseIdParam(req.params.id, NOT_FOUND_MESSAGE)) });
});

productsRouter.post('/', async (req, res) => {
  const input = createProductSchema.parse(req.body ?? {});
  const product = await createProduct(input, getAuth(req).user.id);
  res.status(201).json({ product });
});

productsRouter.patch('/:id', async (req, res) => {
  const id = parseIdParam(req.params.id, NOT_FOUND_MESSAGE);
  const changes = updateProductSchema.parse(req.body ?? {});
  res.json({ product: await updateProduct(id, changes, getAuth(req).user.id) });
});
