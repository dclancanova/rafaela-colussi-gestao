import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ErrorAlert } from '../../components/AuthCard';
import { inputClass, linkClass, primaryActionClass } from '../../components/form-styles';
import { errorMessage } from '../../lib/error-message';
import { formatCents } from '../../lib/money';
import { formatBasisPoints, formatPercent } from '../../lib/percent';
import { marginLevel, marginLevelClass } from '../../lib/pricing';
import { getPricingSettings, pricingSettingsKey } from '../settings/pricing-settings-api';
import { listProducts, productsKeys, type ProductStatus } from './products-api';

const statusLabels: Record<ProductStatus, string> = {
  active: 'Ativos',
  archived: 'Arquivados',
  all: 'Ativos e arquivados',
};

function statusFromParams(params: URLSearchParams): ProductStatus {
  const status = params.get('situacao');
  return status === 'archived' || status === 'all' ? status : 'active';
}

export function ProductsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const status = statusFromParams(searchParams);
  const [search, setSearch] = useState('');

  const productsQuery = useQuery({
    queryKey: productsKeys.list(status),
    queryFn: () => listProducts(status),
  });
  const settingsQuery = useQuery({ queryKey: pricingSettingsKey, queryFn: getPricingSettings });

  const term = search.trim().toLocaleLowerCase('pt-BR');
  const visible = (productsQuery.data ?? []).filter((product) =>
    product.name.toLocaleLowerCase('pt-BR').includes(term),
  );
  const target = settingsQuery.data?.targetMarginBasisPoints;
  const error = productsQuery.error ?? settingsQuery.error;

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-brand-900">Produtos</h1>
          <p className="text-sm text-stone-600">
            O que vocês vendem, com custo, lucro e margem
            {settingsQuery.data && (
              <>
                {' '}
                (meta de {formatBasisPoints(settingsQuery.data.targetMarginBasisPoints)},{' '}
                <Link to="/configuracoes" className={linkClass}>
                  alterar
                </Link>
                )
              </>
            )}
            .
          </p>
        </div>
        <Link to="/produtos/novo" className={primaryActionClass}>
          Novo produto
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <select
          aria-label="Situação"
          value={status}
          onChange={(event) => {
            const next = event.target.value as ProductStatus;
            setSearchParams(next === 'active' ? {} : { situacao: next }, { replace: true });
          }}
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

      {productsQuery.isPending && <p className="text-stone-600">Carregando…</p>}
      {error && <ErrorAlert>{errorMessage(error)}</ErrorAlert>}

      {productsQuery.isSuccess && visible.length === 0 && (
        <div className="rounded-xl border border-dashed border-stone-300 bg-white p-8 text-center text-stone-600">
          {productsQuery.data.length === 0 && status === 'active' ? (
            <>
              Nenhum produto cadastrado ainda.{' '}
              <Link to="/produtos/novo" className={linkClass}>
                Cadastrar o primeiro
              </Link>
            </>
          ) : (
            'Nenhum produto encontrado com esses filtros.'
          )}
        </div>
      )}

      {visible.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-stone-200 bg-stone-50 text-stone-600">
              <tr>
                <th className="px-4 py-3 font-medium">Nome</th>
                <th className="px-4 py-3 font-medium">Ficha técnica</th>
                <th className="px-4 py-3 text-right font-medium">Custo</th>
                <th className="px-4 py-3 text-right font-medium">Preço</th>
                <th className="px-4 py-3 text-right font-medium">Lucro</th>
                <th className="px-4 py-3 text-right font-medium">Margem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {visible.map((product) => {
                const level = target === undefined ? null : marginLevel(product.marginRatio, target);
                return (
                  <tr key={product.id} className={product.isActive ? '' : 'text-stone-400'}>
                    <td className="px-4 py-3">
                      <Link to={`/produtos/${product.id}`} className={linkClass}>
                        {product.name}
                      </Link>
                      {!product.isActive && (
                        <span className="ml-2 rounded bg-stone-100 px-1.5 py-0.5 text-xs text-stone-500">
                          Arquivado
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-stone-600">{product.recipe.name}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">
                      {formatCents(product.totalCostCents)}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">
                      {formatCents(product.priceCents)}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">
                      {formatCents(product.profitCents)}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-medium whitespace-nowrap tabular-nums ${
                        level && product.isActive ? marginLevelClass[level] : ''
                      }`}
                    >
                      {product.marginRatio === null ? '—' : formatPercent(product.marginRatio)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
