import { eq } from 'drizzle-orm';
import { db, type Database, type Transaction } from '../../database/client.js';
import { pricingSettings } from '../../database/schema/index.js';
import { recordAudit } from '../../shared/audit.js';
import type { PricingSettingsValues } from '../products/pricing.js';

const SETTINGS_ID = 1;

// Mesmos valores padrão das colunas: valem até alguém salvar a configuração pela primeira vez.
const DEFAULTS: PricingSettingsValues = { indirectCostBasisPoints: 0, targetMarginBasisPoints: 6000 };

export async function getPricingSettings(
  executor: Database | Transaction = db,
): Promise<PricingSettingsValues> {
  const [row] = await executor
    .select({
      indirectCostBasisPoints: pricingSettings.indirectCostBasisPoints,
      targetMarginBasisPoints: pricingSettings.targetMarginBasisPoints,
    })
    .from(pricingSettings)
    .where(eq(pricingSettings.id, SETTINGS_ID));
  return row ?? DEFAULTS;
}

export async function updatePricingSettings(
  changes: Partial<PricingSettingsValues>,
  actorUserId: number,
): Promise<PricingSettingsValues> {
  return db.transaction(async (tx) => {
    const before = await getPricingSettings(tx);
    const after = { ...before, ...changes };

    const diff: Record<string, { from: number; to: number }> = {};
    for (const field of Object.keys(after) as (keyof PricingSettingsValues)[]) {
      if (before[field] !== after[field]) diff[field] = { from: before[field], to: after[field] };
    }
    if (Object.keys(diff).length === 0) return before;

    // "Insere ou atualiza": na primeira vez a linha ainda não existe.
    await tx
      .insert(pricingSettings)
      .values({ id: SETTINGS_ID, ...after })
      .onConflictDoUpdate({ target: pricingSettings.id, set: { ...after, updatedAt: new Date() } });

    await recordAudit(tx, {
      userId: actorUserId,
      entityType: 'pricing_settings',
      entityId: SETTINGS_ID,
      action: 'update',
      changes: diff,
    });
    return after;
  });
}
