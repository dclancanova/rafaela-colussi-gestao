// Decisão AS: a API troca percentuais em pontos-base inteiros (20% = 2000).

const percentFormat = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 1 });

/** 0.655 → "65,5%". Recebe a fração (como `marginRatio` da API). */
export function formatPercent(ratio: number): string {
  return percentFormat.format(ratio);
}

/** 2050 → "20,5%" */
export function formatBasisPoints(basisPoints: number): string {
  return formatPercent(basisPoints / 10_000);
}

/** 2050 → "20,5": o valor do campo ao editar. */
export function basisPointsToInput(basisPoints: number): string {
  return String(basisPoints / 100).replace('.', ',');
}

/** "20", "20,5", "20,55" ou "20%" → pontos-base inteiros; null se inválido. Até 2 casas. */
export function parsePercentToBasisPoints(text: string): number | null {
  const cleaned = text.replace(/%/g, '').replace(/\s/g, '');
  const match = /^(\d+)(?:,(\d{1,2}))?$/.exec(cleaned);
  if (!match) return null;
  // Conta com texto, sem multiplicar decimais (mesmo cuidado do dinheiro).
  return Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
}
