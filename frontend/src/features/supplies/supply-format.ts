import { formatCents } from '../../lib/money';
import { formatQuantity, type MeasurementUnit } from '../../lib/units';
import type { SupplyKind } from './supplies-api';

export const kindLabels: Record<SupplyKind, string> = {
  ingredient: 'Ingrediente',
  packaging: 'Embalagem',
};

/** 1000, 'g', 650 → "1.000 g por R$ 6,50" */
export function formatPackage(quantity: number, unit: MeasurementUnit, priceCents: number): string {
  return `${formatQuantity(quantity)} ${unit} por ${formatCents(priceCents)}`;
}
