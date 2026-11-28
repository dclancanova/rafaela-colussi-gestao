// Decisão AD: a API troca dinheiro em centavos inteiros; só a tela mostra reais.

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** 650 → "R$ 6,50". Aceita centavos fracionários (custo por grama) e arredonda só para exibir. */
export function formatCents(cents: number): string {
  return brl.format(cents / 100);
}

/**
 * Texto digitado → centavos inteiros, ou null se não for um valor válido.
 * Aceita "6", "6,5", "6,50", "1.234,56" e "R$ 6,50". Recusa "6.50": no Brasil o ponto separa milhar.
 * Faz a conta com texto, sem multiplicar decimais (6.5 * 100 pode dar 649.9999…).
 */
export function parseMoneyToCents(text: string): number | null {
  const cleaned = text.replace(/R\$/i, '').replace(/\s/g, '');
  const match = /^(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?$/.exec(cleaned);
  if (!match) return null;

  const reais = Number(match[1]!.replaceAll('.', ''));
  const cents = Number((match[2] ?? '').padEnd(2, '0'));
  return reais * 100 + cents;
}

/** 650 → "6,50": o valor que aparece no campo ao editar. */
export function centsToInput(cents: number): string {
  return `${Math.trunc(cents / 100)},${String(cents % 100).padStart(2, '0')}`;
}
