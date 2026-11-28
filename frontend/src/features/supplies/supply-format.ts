import { formatCents } from '../../lib/money';
import type { MeasurementUnit, SupplyKind } from './supplies-api';

export const kindLabels: Record<SupplyKind, string> = {
  ingredient: 'Ingrediente',
  packaging: 'Embalagem',
};

export const unitLabels: Record<MeasurementUnit, string> = {
  g: 'gramas (g)',
  ml: 'mililitros (ml)',
  un: 'unidades (un)',
};

const quantityFormat = new Intl.NumberFormat('pt-BR');

/** 1000, 'g', 650 → "1.000 g por R$ 6,50" */
export function formatPackage(quantity: number, unit: MeasurementUnit, priceCents: number): string {
  return `${quantityFormat.format(quantity)} ${unit} por ${formatCents(priceCents)}`;
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
