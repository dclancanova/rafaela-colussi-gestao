import { Router } from 'express';
import { z } from 'zod';
import { getAuth, requireAuth, requireRole } from '../auth/auth.middleware.js';
import { getPricingSettings, updatePricingSettings } from './pricing-settings.service.js';

const basisPoints = (max: number, label: string) =>
  z
    .number({ error: `Informe ${label}` })
    .int(`${label} deve ter no máximo 2 casas decimais`)
    .min(0, `${label} não pode ser negativo`)
    .max(max, `${label} acima do permitido`);

const updateSchema = z
  .object({
    indirectCostBasisPoints: basisPoints(50_000, 'O percentual de custos indiretos'),
    // Decisão AU: margem de 100% exigiria preço infinito.
    targetMarginBasisPoints: basisPoints(9_500, 'A margem-alvo'),
  })
  .partial()
  .refine((changes) => Object.values(changes).some((value) => value !== undefined), {
    message: 'Nada para alterar',
  });

export const pricingSettingsRouter = Router();

pricingSettingsRouter.use(requireAuth);

pricingSettingsRouter.get('/', async (_req, res) => {
  res.json({ settings: await getPricingSettings() });
});

// Decisão AT: muda o preço sugerido de todos os produtos, então só admin altera.
pricingSettingsRouter.patch('/', requireRole('admin'), async (req, res) => {
  const changes = updateSchema.parse(req.body ?? {});
  res.json({ settings: await updatePricingSettings(changes, getAuth(req).user.id) });
});
