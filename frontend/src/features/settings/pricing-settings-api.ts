import { api } from '../../lib/api';
import type { PricingSettings } from '../../lib/pricing';

export type { PricingSettings };

export const pricingSettingsKey = ['settings', 'pricing'] as const;

export async function getPricingSettings(): Promise<PricingSettings> {
  const { settings } = await api<{ settings: PricingSettings }>('/settings/pricing');
  return settings;
}

export async function updatePricingSettings(changes: Partial<PricingSettings>): Promise<PricingSettings> {
  const { settings } = await api<{ settings: PricingSettings }>('/settings/pricing', {
    method: 'PATCH',
    body: changes,
  });
  return settings;
}
