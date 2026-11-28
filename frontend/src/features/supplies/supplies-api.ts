import { api } from '../../lib/api';

export type SupplyKind = 'ingredient' | 'packaging';
export type MeasurementUnit = 'g' | 'ml' | 'un';
export type SupplyStatus = 'active' | 'archived' | 'all';

/** Mesmo formato que o backend devolve em /supplies. */
export type Supply = {
  id: number;
  name: string;
  kind: SupplyKind;
  unit: MeasurementUnit;
  packageQuantity: number;
  packagePriceCents: number;
  /** Custo de 1 g, 1 ml ou 1 un, em centavos com casas decimais (calculado pela API). */
  unitCostCents: number;
  notes: string | null;
  isActive: boolean;
  updatedAt: string;
};

export type SupplyInput = Pick<
  Supply,
  'name' | 'kind' | 'unit' | 'packageQuantity' | 'packagePriceCents' | 'notes'
>;

export type SupplyFilter = { kind?: SupplyKind; status: SupplyStatus };

/** Chaves do cache: invalidar `suppliesKeys.all` atualiza listas e detalhes de uma vez. */
export const suppliesKeys = {
  all: ['supplies'] as const,
  list: (filter: SupplyFilter) => ['supplies', 'list', filter] as const,
  detail: (id: number) => ['supplies', 'detail', id] as const,
};

export async function listSupplies(filter: SupplyFilter): Promise<Supply[]> {
  const params = new URLSearchParams({ status: filter.status });
  if (filter.kind) params.set('kind', filter.kind);
  const { supplies } = await api<{ supplies: Supply[] }>(`/supplies?${params}`);
  return supplies;
}

export async function getSupply(id: number): Promise<Supply> {
  const { supply } = await api<{ supply: Supply }>(`/supplies/${id}`);
  return supply;
}

export async function createSupply(input: SupplyInput): Promise<Supply> {
  const { supply } = await api<{ supply: Supply }>('/supplies', { method: 'POST', body: input });
  return supply;
}

export async function updateSupply(
  id: number,
  changes: Partial<SupplyInput & { isActive: boolean }>,
): Promise<Supply> {
  const { supply } = await api<{ supply: Supply }>(`/supplies/${id}`, { method: 'PATCH', body: changes });
  return supply;
}
