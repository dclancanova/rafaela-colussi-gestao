import { Router } from 'express';
import { z } from 'zod';
import { parseIdParam } from '../../shared/route-params.js';
import { getAuth, requireAuth } from '../auth/auth.middleware.js';
import { createCategory, ENTRY_KINDS, listCategories, updateCategory } from './categories.service.js';

const nameSchema = z.string().trim().min(1, 'Informe o nome').max(80, 'Nome longo demais');

const createSchema = z.object({
  name: nameSchema,
  kind: z.enum(ENTRY_KINDS, { error: 'Escolha entrada ou saída' }),
});

const updateSchema = z
  .object({ name: nameSchema, isActive: z.boolean({ error: 'Valor inválido' }) })
  .partial()
  .refine((changes) => Object.values(changes).some((value) => value !== undefined), {
    message: 'Nada para alterar',
  });

const listQuerySchema = z.object({
  kind: z.enum(ENTRY_KINDS).optional(),
  status: z.enum(['active', 'archived', 'all']).default('active'),
});

export const financeCategoriesRouter = Router();

financeCategoriesRouter.use(requireAuth);

financeCategoriesRouter.get('/', async (req, res) => {
  res.json({ categories: await listCategories(listQuerySchema.parse(req.query)) });
});

financeCategoriesRouter.post('/', async (req, res) => {
  const input = createSchema.parse(req.body ?? {});
  res.status(201).json({ category: await createCategory(input, getAuth(req).user.id) });
});

financeCategoriesRouter.patch('/:id', async (req, res) => {
  const id = parseIdParam(req.params.id, 'Categoria não encontrada');
  const changes = updateSchema.parse(req.body ?? {});
  res.json({ category: await updateCategory(id, changes, getAuth(req).user.id) });
});
