/**
 * Prévia de preço na tela, enquanto se digita. É a MESMA conta do backend
 * (backend/src/modules/products/pricing.ts, decisão AU): se mudar lá, mude aqui.
 * O valor que vale é sempre o que a API devolve depois de salvar.
 */
export type PricingSettings = {
  indirectCostBasisPoints: number;
  targetMarginBasisPoints: number;
};

export function previewPricing(directCostCents: number, priceCents: number, settings: PricingSettings) {
  const totalCost = directCostCents * (1 + settings.indirectCostBasisPoints / 10_000);
  const profit = priceCents - totalCost;
  const directRounded = Math.round(directCostCents);
  const totalRounded = Math.round(totalCost);

  return {
    directCostCents: directRounded,
    indirectCostCents: totalRounded - directRounded,
    totalCostCents: totalRounded,
    profitCents: Math.round(profit),
    marginRatio: priceCents > 0 ? profit / priceCents : null,
    suggestedPriceCents: Math.ceil(totalCost / (1 - settings.targetMarginBasisPoints / 10_000) - 1e-9),
  };
}

export type MarginLevel = 'loss' | 'below-target' | 'on-target';

/** Classifica a margem para colorir: prejuízo, abaixo da meta, ou na meta. */
export function marginLevel(marginRatio: number | null, targetMarginBasisPoints: number): MarginLevel | null {
  if (marginRatio === null) return null;
  if (marginRatio < 0) return 'loss';
  // Pequena folga: 59,9999…% por imprecisão não pode aparecer como "abaixo da meta de 60%".
  return marginRatio + 1e-9 >= targetMarginBasisPoints / 10_000 ? 'on-target' : 'below-target';
}

export const marginLevelClass: Record<MarginLevel, string> = {
  loss: 'text-red-700',
  'below-target': 'text-amber-700',
  'on-target': 'text-emerald-700',
};
