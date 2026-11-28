import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { ErrorAlert } from '../../components/AuthCard';
import { inputClass, linkClass, primaryActionClass } from '../../components/form-styles';
import { errorMessage } from '../../lib/error-message';
import {
  createCategory,
  financeKeys,
  listCategories,
  updateCategory,
  type EntryKind,
  type FinanceCategory,
} from './finance-api';

const kindTitles: Record<EntryKind, string> = { income: 'Entradas', expense: 'Saídas' };

export function CategoriesPage() {
  const categoriesQuery = useQuery({
    queryKey: financeKeys.categories('all'),
    queryFn: () => listCategories('all'),
  });

  return (
    <section className="max-w-3xl space-y-6">
      <div>
        <Link to="/financeiro" className={`text-sm ${linkClass}`}>
          ← Financeiro
        </Link>
        <h1 className="mt-1 text-2xl font-semibold text-brand-900">Categorias</h1>
        <p className="text-sm text-stone-600">
          Usadas para separar as entradas e saídas nos relatórios. Arquivar tira a categoria das opções, mas
          os lançamentos antigos continuam nela.
        </p>
      </div>

      {categoriesQuery.isError && <ErrorAlert>{errorMessage(categoriesQuery.error)}</ErrorAlert>}
      {categoriesQuery.isPending && <p className="text-stone-600">Carregando…</p>}

      {categoriesQuery.data && (
        <div className="grid gap-6 md:grid-cols-2">
          {(['income', 'expense'] as EntryKind[]).map((kind) => (
            <CategoryGroup
              key={kind}
              kind={kind}
              categories={categoriesQuery.data.filter((category) => category.kind === kind)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function CategoryGroup({ kind, categories }: { kind: EntryKind; categories: FinanceCategory[] }) {
  const [name, setName] = useState('');
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: financeKeys.all });

  const createMutation = useMutation({
    mutationFn: createCategory,
    onSuccess: async () => {
      setName('');
      await invalidate();
    },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, changes }: { id: number; changes: { name?: string; isActive?: boolean } }) =>
      updateCategory(id, changes),
    onSuccess: invalidate,
  });

  function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (name.trim()) createMutation.mutate({ name: name.trim(), kind });
  }

  function rename(category: FinanceCategory) {
    const next = window.prompt('Novo nome da categoria:', category.name)?.trim();
    if (next && next !== category.name) updateMutation.mutate({ id: category.id, changes: { name: next } });
  }

  const error = createMutation.error ?? updateMutation.error;
  // Ativas primeiro; arquivadas no fim, apagadas.
  const sorted = [...categories].sort((a, b) => Number(b.isActive) - Number(a.isActive));

  return (
    <div className="space-y-3 rounded-xl border border-stone-200 bg-white p-5">
      <h2 className="font-medium text-stone-800">{kindTitles[kind]}</h2>
      {error && <ErrorAlert>{errorMessage(error)}</ErrorAlert>}

      <ul className="divide-y divide-stone-100">
        {sorted.map((category) => (
          <li key={category.id} className="flex items-center justify-between gap-2 py-2 text-sm">
            <span className={category.isActive ? 'text-stone-800' : 'text-stone-400'}>
              {category.name}
              {!category.isActive && ' (arquivada)'}
            </span>
            <span className="flex gap-1">
              <button
                type="button"
                onClick={() => rename(category)}
                className="rounded px-2 py-1 text-stone-500 hover:bg-stone-100 hover:text-stone-800"
              >
                Renomear
              </button>
              <button
                type="button"
                onClick={() =>
                  updateMutation.mutate({ id: category.id, changes: { isActive: !category.isActive } })
                }
                className="rounded px-2 py-1 text-stone-500 hover:bg-stone-100 hover:text-stone-800"
              >
                {category.isActive ? 'Arquivar' : 'Reativar'}
              </button>
            </span>
          </li>
        ))}
      </ul>

      <form onSubmit={handleCreate} className="flex gap-2">
        <input
          aria-label={`Nova categoria de ${kindTitles[kind].toLowerCase()}`}
          placeholder="Nova categoria…"
          maxLength={80}
          value={name}
          onChange={(event) => setName(event.target.value)}
          className={`${inputClass} text-sm`}
        />
        <button
          type="submit"
          disabled={createMutation.isPending || !name.trim()}
          className={primaryActionClass}
        >
          Adicionar
        </button>
      </form>
    </div>
  );
}
