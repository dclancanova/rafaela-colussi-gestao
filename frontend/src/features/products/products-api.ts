import { api } from '../../lib/api';
import type { MeasurementUnit } from '../../lib/units';

export type ProductStatus = 'active' | 'archived' | 'all';

/** Mesmo formato que o backend devolve em /products. Custos e margem já calculados. */
export type Product = {
  id: number;
  name: string;
  recipe: { id: number; name: string; yieldUnit: MeasurementUnit; isActive: boolean };
  recipeQuantity: number;
  priceCents: number;
  notes: string | null;
  isActive: boolean;
  updatedAt: string;
  directCostCents: number;
  indirectCostCents: number;
  totalCostCents: number;
  profitCents: number;
  /** Fração (0,65 = 65%); null quando o preço é zero. */
  marginRatio: number | null;
  suggestedPriceCents: number;
};

export type ProductInput = {
  name: string;
  recipeId: number;
  recipeQuantity: number;
  priceCents: number;
  notes: string | null;
};

export const productsKeys = {
  all: ['products'] as const,
  list: (status: ProductStatus) => ['products', 'list', status] as const,
  detail: (id: number) => ['products', 'detail', id] as const,
};

export async function listProducts(status: ProductStatus): Promise<Product[]> {
  const { products } = await api<{ products: Product[] }>(`/products?status=${status}`);
  return products;
}

export async function getProduct(id: number): Promise<Product> {
  const { product } = await api<{ product: Product }>(`/products/${id}`);
  return product;
}

export async function createProduct(input: ProductInput): Promise<Product> {
  const { product } = await api<{ product: Product }>('/products', { method: 'POST', body: input });
  return product;
}

export async function updateProduct(
  id: number,
  changes: Partial<ProductInput & { isActive: boolean }>,
): Promise<Product> {
  const { product } = await api<{ product: Product }>(`/products/${id}`, { method: 'PATCH', body: changes });
  return product;
}
