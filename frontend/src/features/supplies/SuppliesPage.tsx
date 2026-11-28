import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ErrorAlert } from '../../components/AuthCard';
import { inputClass, linkClass, primaryActionClass } from '../../components/form-styles';
import { errorMessage } from '../../lib/error-message';
import {
  listSupplies,
  suppliesKeys,
  type SupplyFilter,
  type SupplyKind,
  type SupplyStatus,
} from './supplies-api';
import { formatUnitCost } from '../../lib/units';
import { formatPackage, kindLabels } from './supply-format';

const kindOptions: { value: SupplyKind | undefined; label: string }[] = [
  { value: undefined, label: 'Todos' },
  { value: 'ingredient', label: 'Ingredientes' },
  { value: 'packaging', label: 'Embalagens' },
];

const statusLabels: Record<SupplyStatus, string> = {
  active: 'Ativos',
  archived: 'Arquivados',
  all: 'Ativos e arquivados',
};

/** Lê os filtros da URL; valor estranho na URL vira o padrão em vez de quebrar a tela. */
function filterFromParams(params: URLSearchParams): SupplyFilter {
  const kind = params.get('tipo');
  const status = params.get('situacao');
  return {
    kind: kind === 'ingredient' || kind === 'packaging' ? kind : undefined,
    status: status === 'archived' || status === 'all' ? status : 'active',
  };
}

export function SuppliesPage() {
  // Filtros na URL: dá para recarregar, voltar e compartilhar o link sem perder a seleção.
  const [searchParams, setSearchParams] = useSearchParams();
  const filter = filterFromParams(searchParams);
  const [search, setSearch] = useState('');

  const suppliesQuery = useQuery({
    queryKey: suppliesKeys.list(filter),
    queryFn: () => listSupplies(filter),
  });

  function updateFilter(next: Partial<SupplyFilter>) {
    const merged = { ...filter, ...next };
    const params = new URLSearchParams();
    if (merged.kind) params.set('tipo', merged.kind);
    if (merged.status !== 'active') params.set('situacao', merged.status);
    setSearchParams(params, { replace: true });
  }

  // A busca por nome é feita aqui mesmo: a lista inteira já está na tela.
  const term = search.trim().toLocaleLowerCase('pt-BR');
  const visible = (suppliesQuery.data ?? []).filter((supply) =>
    supply.name.toLocaleLowerCase('pt-BR').includes(term),
  );

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-brand-900">Insumos</h1>
          <p className="text-sm text-stone-600">Ingredientes e embalagens, com o preço da última compra.</p>
        </div>
        <Link to="/insumos/novo" className={primaryActionClass}>
          Novo insumo
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div
          className="flex rounded-lg border border-stone-300 bg-white p-0.5"
          role="group"
          aria-label="Tipo"
        >
          {kindOptions.map((option) => (
            <button
              key={option.label}
              type="button"
              aria-pressed={filter.kind === option.value}
              onClick={() => updateFilter({ kind: option.value })}
              className={`rounded-md px-3 py-1.5 text-sm ${
                filter.kind === option.value
                  ? 'bg-brand-100 font-medium text-brand-900'
                  : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <select
          aria-label="Situação"
          value={filter.status}
          onChange={(event) => updateFilter({ status: event.target.value as SupplyStatus })}
          className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
        >
          {Object.entries(statusLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        <input
          type="search"
          aria-label="Buscar pelo nome"
          placeholder="Buscar pelo nome…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className={`${inputClass} max-w-xs flex-1 text-sm`}
        />
      </div>

      {suppliesQuery.isPending && <p className="text-stone-600">Carregando…</p>}
      {suppliesQuery.isError && <ErrorAlert>{errorMessage(suppliesQuery.error)}</ErrorAlert>}

      {suppliesQuery.isSuccess && visible.length === 0 && (
        <div className="rounded-xl border border-dashed border-stone-300 bg-white p-8 text-center text-stone-600">
          {suppliesQuery.data.length === 0 && filter.status === 'active' && !filter.kind ? (
            <>
              Nenhum insumo cadastrado ainda.{' '}
              <Link to="/insumos/novo" className={linkClass}>
                Cadastrar o primeiro
              </Link>
            </>
          ) : (
            'Nenhum insumo encontrado com esses filtros.'
          )}
        </div>
      )}

      {visible.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-stone-200 bg-stone-50 text-stone-600">
              <tr>
                <th className="px-4 py-3 font-medium">Nome</th>
                <th className="px-4 py-3 font-medium">Tipo</th>
                <th className="px-4 py-3 font-medium">Embalagem</th>
                <th className="px-4 py-3 text-right font-medium">Custo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {visible.map((supply) => (
                <tr key={supply.id} className={supply.isActive ? '' : 'text-stone-400'}>
                  <td className="px-4 py-3">
                    <Link to={`/insumos/${supply.id}`} className={linkClass}>
                      {supply.name}
                    </Link>
                    {!supply.isActive && (
                      <span className="ml-2 rounded bg-stone-100 px-1.5 py-0.5 text-xs text-stone-500">
                        Arquivado
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">{kindLabels[supply.kind]}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {formatPackage(supply.packageQuantity, supply.unit, supply.packagePriceCents)}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">
                    {formatUnitCost(supply.unitCostCents, supply.unit)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
