import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ErrorAlert } from '../../components/AuthCard';
import { inputClass, linkClass, primaryActionClass } from '../../components/form-styles';
import { errorMessage } from '../../lib/error-message';
import { formatCents } from '../../lib/money';
import { formatQuantity, formatUnitCost } from '../../lib/units';
import { listRecipes, recipesKeys, type RecipeStatus } from './recipes-api';

const statusLabels: Record<RecipeStatus, string> = {
  active: 'Ativas',
  archived: 'Arquivadas',
  all: 'Ativas e arquivadas',
};

function statusFromParams(params: URLSearchParams): RecipeStatus {
  const status = params.get('situacao');
  return status === 'archived' || status === 'all' ? status : 'active';
}

export function RecipesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const status = statusFromParams(searchParams);
  const [search, setSearch] = useState('');

  const recipesQuery = useQuery({
    queryKey: recipesKeys.list(status),
    queryFn: () => listRecipes(status),
  });

  function changeStatus(next: RecipeStatus) {
    setSearchParams(next === 'active' ? {} : { situacao: next }, { replace: true });
  }

  const term = search.trim().toLocaleLowerCase('pt-BR');
  const visible = (recipesQuery.data ?? []).filter((recipe) =>
    recipe.name.toLocaleLowerCase('pt-BR').includes(term),
  );

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-brand-900">Fichas técnicas</h1>
          <p className="text-sm text-stone-600">
            Receitas e preparos, com o custo calculado pelos preços atuais dos insumos.
          </p>
        </div>
        <Link to="/fichas-tecnicas/nova" className={primaryActionClass}>
          Nova ficha técnica
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <select
          aria-label="Situação"
          value={status}
          onChange={(event) => changeStatus(event.target.value as RecipeStatus)}
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

      {recipesQuery.isPending && <p className="text-stone-600">Carregando…</p>}
      {recipesQuery.isError && <ErrorAlert>{errorMessage(recipesQuery.error)}</ErrorAlert>}

      {recipesQuery.isSuccess && visible.length === 0 && (
        <div className="rounded-xl border border-dashed border-stone-300 bg-white p-8 text-center text-stone-600">
          {recipesQuery.data.length === 0 && status === 'active' ? (
            <>
              Nenhuma ficha técnica cadastrada ainda.{' '}
              <Link to="/fichas-tecnicas/nova" className={linkClass}>
                Cadastrar a primeira
              </Link>
            </>
          ) : (
            'Nenhuma ficha técnica encontrada com esses filtros.'
          )}
        </div>
      )}

      {visible.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-stone-200 bg-stone-50 text-stone-600">
              <tr>
                <th className="px-4 py-3 font-medium">Nome</th>
                <th className="px-4 py-3 font-medium">Rende</th>
                <th className="px-4 py-3 text-right font-medium">Custo total</th>
                <th className="px-4 py-3 text-right font-medium">Custo por unidade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {visible.map((recipe) => (
                <tr key={recipe.id} className={recipe.isActive ? '' : 'text-stone-400'}>
                  <td className="px-4 py-3">
                    <Link to={`/fichas-tecnicas/${recipe.id}`} className={linkClass}>
                      {recipe.name}
                    </Link>
                    {!recipe.isActive && (
                      <span className="ml-2 rounded bg-stone-100 px-1.5 py-0.5 text-xs text-stone-500">
                        Arquivada
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {formatQuantity(recipe.yieldQuantity)} {recipe.yieldUnit}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">
                    {formatCents(recipe.totalCostCents)}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">
                    {formatUnitCost(recipe.costPerYieldUnitCents, recipe.yieldUnit)}
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
