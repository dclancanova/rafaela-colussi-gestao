import { Router } from 'express';
import { z } from 'zod';
import { parseIdParam } from '../../shared/route-params.js';
import { getAuth, requireAuth } from '../auth/auth.middleware.js';
import { MEASUREMENT_UNITS } from '../supplies/supplies.service.js';
import { createRecipe, getRecipe, listRecipes, updateRecipe } from './recipes.service.js';

const NOT_FOUND_MESSAGE = 'Ficha técnica não encontrada';
const MAX_QUANTITY = 1_000_000;
const MAX_ITEMS = 100;

// Decisão AM: até 3 casas decimais. Arredonda antes de conferir, como o banco faria (numeric(12,3)).
const quantitySchema = z
  .number({ error: 'Informe a quantidade' })
  .transform((value) => Math.round(value * 1000) / 1000)
  .pipe(
    z.number().positive('A quantidade deve ser maior que zero').max(MAX_QUANTITY, 'Quantidade grande demais'),
  );

const componentId = z.number().int().positive();

const itemSchema = z
  .object({
    supplyId: componentId.optional(),
    recipeId: componentId.optional(),
    quantity: quantitySchema,
  })
  .refine((item) => (item.supplyId === undefined) !== (item.recipeId === undefined), {
    message: 'Escolha um insumo ou uma ficha técnica',
  });

const recipeFields = {
  name: z.string().trim().min(1, 'Informe o nome').max(120, 'Nome longo demais'),
  yieldQuantity: quantitySchema,
  yieldUnit: z.enum(MEASUREMENT_UNITS, { error: 'Escolha a unidade do rendimento: g, ml ou un' }),
  notes: z
    .string()
    .trim()
    .max(2000, 'Observação longa demais')
    .nullable()
    .transform((value) => (value === '' ? null : value))
    .optional(),
  items: z
    .array(itemSchema, { error: 'Informe os itens' })
    .min(1, 'Adicione pelo menos um item')
    .max(MAX_ITEMS, 'Itens demais'),
};

const createRecipeSchema = z.object(recipeFields);

const updateRecipeSchema = z
  .object({ ...recipeFields, isActive: z.boolean({ error: 'Valor inválido' }) })
  .partial()
  .refine((changes) => Object.values(changes).some((value) => value !== undefined), {
    message: 'Nada para alterar',
  });

const listQuerySchema = z.object({
  status: z.enum(['active', 'archived', 'all']).default('active'),
});

export const recipesRouter = Router();

recipesRouter.use(requireAuth);

recipesRouter.get('/', async (req, res) => {
  const filter = listQuerySchema.parse(req.query);
  res.json({ recipes: await listRecipes(filter) });
});

recipesRouter.get('/:id', async (req, res) => {
  res.json({ recipe: await getRecipe(parseIdParam(req.params.id, NOT_FOUND_MESSAGE)) });
});

recipesRouter.post('/', async (req, res) => {
  const input = createRecipeSchema.parse(req.body ?? {});
  const recipe = await createRecipe(input, getAuth(req).user.id);
  res.status(201).json({ recipe });
});

recipesRouter.patch('/:id', async (req, res) => {
  const id = parseIdParam(req.params.id, NOT_FOUND_MESSAGE);
  const changes = updateRecipeSchema.parse(req.body ?? {});
  res.json({ recipe: await updateRecipe(id, changes, getAuth(req).user.id) });
});
