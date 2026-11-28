import type { QueryClient } from '@tanstack/react-query';
import { productsKeys } from '../products/products-api';
import { recipesKeys } from '../recipes/recipes-api';
import { pricingSettingsKey } from '../settings/pricing-settings-api';
import { suppliesKeys } from '../supplies/supplies-api';

/**
 * Insumos, fichas, produtos e configuração de preços dependem uns dos outros:
 * o preço do chocolate muda o custo do recheio, que muda o custo do bolo, que muda a margem do produto.
 * Depois de salvar qualquer um deles, todas as listas e detalhes do catálogo são buscados de novo.
 */
export async function invalidateCatalog(queryClient: QueryClient): Promise<void> {
  await Promise.all(
    [suppliesKeys.all, recipesKeys.all, productsKeys.all, pricingSettingsKey].map((queryKey) =>
      queryClient.invalidateQueries({ queryKey }),
    ),
  );
}
