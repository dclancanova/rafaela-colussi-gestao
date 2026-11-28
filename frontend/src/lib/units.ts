import { formatCents } from './money';

// Decisão F: unidades-base, usadas por insumos e pelo rendimento das fichas técnicas.
export type MeasurementUnit = 'g' | 'ml' | 'un';

export const unitLabels: Record<MeasurementUnit, string> = {
  g: 'gramas (g)',
  ml: 'mililitros (ml)',
  un: 'unidades (un)',
};

const quantityFormat = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 });

/** 1000 → "1.000"; 2.5 → "2,5" */
export function formatQuantity(quantity: number): string {
  return quantityFormat.format(quantity);
}

/** 1000 → "1000"; 2.5 → "2,5": o valor que aparece no campo ao editar (sem ponto de milhar). */
export function quantityToInput(quantity: number): string {
  return String(quantity).replace('.', ',');
}

/**
 * Texto digitado → quantidade, ou null se não for válida. Até 3 casas (decisão AM).
 * Aceita "2", "2,5", "0,125", "1.000" e "1.000,5". Como no dinheiro, o ponto separa milhar.
 */
export function parseQuantity(text: string): number | null {
  const cleaned = text.replace(/\s/g, '');
  const match = /^(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,3}))?$/.exec(cleaned);
  if (!match) return null;
  return Number(`${match[1]!.replaceAll('.', '')}.${match[2] ?? '0'}`);
}

/**
 * Custo por unidade-base em uma escala fácil de ler: "R$ 0,0065/g" não diz nada,
 * mas "R$ 6,50/kg" é o que se compara no mercado. Gramas → kg, ml → litro, unidade → unidade.
 */
export function formatUnitCost(unitCostCents: number, unit: MeasurementUnit): string {
  if (unit === 'g') return `${formatCents(unitCostCents * 1000)}/kg`;
  if (unit === 'ml') return `${formatCents(unitCostCents * 1000)}/L`;
  return `${formatCents(unitCostCents)}/un`;
}
