/**
 * Percentuais em pontos-base inteiros (decisão AS): 1% = 100, 20% = 2000, 100% = 10000.
 * Inteiro pelo mesmo motivo do dinheiro: 20,5% fica exato (2050).
 */
export const BASIS_POINTS_PER_UNIT = 10_000;

export type PricingSettingsValues = {
  /** Custos indiretos (gás, energia, mão de obra, taxas) somados ao custo da ficha. */
  indirectCostBasisPoints: number;
  /** Margem desejada sobre o preço de venda, usada para sugerir o preço. */
  targetMarginBasisPoints: number;
};

/**
 * Custos, lucro e margem de um produto (decisão AU).
 *
 * - custo total = custo direto × (1 + indiretos)
 * - margem = lucro ÷ preço (quanto de cada real vendido sobra)
 * - preço sugerido = custo total ÷ (1 − margem-alvo), arredondado PARA CIMA no centavo
 *
 * `directCostCents` chega com casas decimais; o arredondamento acontece só aqui (decisão AF).
 */
export function calculateProductPricing(
  directCostCents: number,
  priceCents: number,
  settings: PricingSettingsValues,
) {
  const totalCost = directCostCents * (1 + settings.indirectCostBasisPoints / BASIS_POINTS_PER_UNIT);
  const profit = priceCents - totalCost;

  const directRounded = Math.round(directCostCents);
  const totalRounded = Math.round(totalCost);

  // Pequena folga antes do "para cima": 105 calculado como 105,00000000001 não pode virar 106.
  const targetShare = 1 - settings.targetMarginBasisPoints / BASIS_POINTS_PER_UNIT;
  const suggestedPriceCents = Math.ceil(totalCost / targetShare - 1e-9);

  return {
    directCostCents: directRounded,
    // Por diferença: direto + indiretos sempre fecha com o total mostrado, sem centavo sobrando.
    indirectCostCents: totalRounded - directRounded,
    totalCostCents: totalRounded,
    profitCents: Math.round(profit),
    /** Fração (0,65 = 65%); null sem preço, porque não existe margem de um preço zero. */
    marginRatio: priceCents > 0 ? profit / priceCents : null,
    suggestedPriceCents,
  };
}
