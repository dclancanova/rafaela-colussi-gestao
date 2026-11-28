/**
 * Custo de 1 unidade-base (1 g, 1 ml ou 1 un), em centavos COM casas decimais.
 * Ex.: 1000 g por 650 centavos → 0,65 centavo por grama.
 * Não arredonda de propósito (decisão AF): o arredondamento acontece só no total da receita.
 */
export function unitCostCents(packagePriceCents: number, packageQuantity: number): number {
  if (packageQuantity <= 0) {
    throw new RangeError('A quantidade da embalagem deve ser maior que zero');
  }
  return packagePriceCents / packageQuantity;
}
