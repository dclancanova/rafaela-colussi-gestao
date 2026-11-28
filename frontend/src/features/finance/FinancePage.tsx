import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router';
import { ErrorAlert } from '../../components/AuthCard';
import { linkClass, primaryActionClass, secondaryActionClass } from '../../components/form-styles';
import { currentMonth, formatDate, formatMonth, parseMonth, shiftMonth } from '../../lib/dates';
import { errorMessage } from '../../lib/error-message';
import { formatCents } from '../../lib/money';
import {
  accountShortLabels,
  deleteMovement,
  financeKeys,
  getBalances,
  listMovements,
  type Movement,
} from './finance-api';

/** Texto e cor do valor: entrada e ajuste positivo somam (verde), saída e ajuste negativo subtraem. */
function amountDisplay(movement: Movement): { text: string; className: string } {
  if (movement.type === 'transfer')
    return { text: formatCents(movement.amountCents), className: 'text-stone-600' };
  const positive = movement.type === 'income' || (movement.type === 'adjustment' && movement.amountCents > 0);
  const value = formatCents(Math.abs(movement.amountCents));
  return positive
    ? { text: `+ ${value}`, className: 'text-emerald-700' }
    : { text: `− ${value}`, className: 'text-red-700' };
}

function movementLabel(movement: Movement): { title: string; detail: string } {
  switch (movement.type) {
    case 'income':
    case 'expense':
      return { title: movement.description, detail: movement.category.name };
    case 'transfer':
      return {
        title: movement.description ?? 'Transferência',
        detail: `Transferência: ${accountShortLabels[movement.fromAccount]} → ${accountShortLabels[movement.toAccount]}`,
      };
    case 'adjustment':
      return { title: movement.description, detail: 'Ajuste de saldo' };
  }
}

export function FinancePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const month = parseMonth(searchParams.get('mes')) ?? currentMonth();
  const isCurrentMonth = month === currentMonth();
  const queryClient = useQueryClient();

  const balancesQuery = useQuery({ queryKey: financeKeys.balances, queryFn: getBalances });
  const movementsQuery = useQuery({
    queryKey: financeKeys.movements(month),
    queryFn: () => listMovements(month),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteMovement,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: financeKeys.all }),
  });

  function goToMonth(next: string) {
    setSearchParams(next === currentMonth() ? {} : { mes: next }, { replace: true });
  }

  function confirmDelete(movement: Movement) {
    const { title } = movementLabel(movement);
    if (window.confirm(`Excluir "${title}" de ${formatDate(movement.occurredOn)}? Isso muda o saldo.`)) {
      deleteMutation.mutate(movement);
    }
  }

  const error = balancesQuery.error ?? movementsQuery.error ?? deleteMutation.error;
  const totals = movementsQuery.data?.totals;

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-brand-900">Financeiro</h1>
          <p className="text-sm text-stone-600">
            Entradas e saídas que já aconteceram.{' '}
            <Link to="/financeiro/categorias" className={linkClass}>
              Categorias
            </Link>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/financeiro/entrada/nova" className={primaryActionClass}>
            + Entrada
          </Link>
          <Link to="/financeiro/saida/nova" className={primaryActionClass}>
            − Saída
          </Link>
          <Link to="/financeiro/transferencia/nova" className={secondaryActionClass}>
            Transferir
          </Link>
          <Link to="/financeiro/ajuste/novo" className={secondaryActionClass}>
            Ajustar saldo
          </Link>
        </div>
      </div>

      {error && <ErrorAlert>{errorMessage(error)}</ErrorAlert>}

      {/* Saldos de hoje: não dependem do mês escolhido. */}
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Caixa (dinheiro)" value={balancesQuery.data?.cash} />
        <StatCard label="Conta (Pix/banco)" value={balancesQuery.data?.bank} />
        <StatCard label="Saldo total" value={balancesQuery.data?.total} strong />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-amendoa pt-6">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => goToMonth(shiftMonth(month, -1))}
            aria-label="Mês anterior"
            className="rounded-lg px-2 py-1 text-stone-600 hover:bg-white"
          >
            ‹
          </button>
          <h2 className="min-w-44 text-center text-lg font-medium text-stone-800 capitalize">
            {formatMonth(month)}
          </h2>
          <button
            type="button"
            onClick={() => goToMonth(shiftMonth(month, 1))}
            disabled={isCurrentMonth}
            aria-label="Próximo mês"
            className="rounded-lg px-2 py-1 text-stone-600 hover:bg-white disabled:invisible"
          >
            ›
          </button>
        </div>
        {totals && (
          <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <div className="flex gap-2">
              <dt className="text-stone-600">Entradas</dt>
              <dd className="font-medium text-emerald-700 tabular-nums">{formatCents(totals.incomeCents)}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-stone-600">Saídas</dt>
              <dd className="font-medium text-red-700 tabular-nums">{formatCents(totals.expenseCents)}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-stone-600">Resultado</dt>
              <dd
                className={`font-semibold tabular-nums ${totals.resultCents < 0 ? 'text-red-700' : 'text-stone-900'}`}
              >
                {formatCents(totals.resultCents)}
              </dd>
            </div>
          </dl>
        )}
      </div>

      {movementsQuery.isPending && <p className="text-stone-600">Carregando…</p>}

      {movementsQuery.data && movementsQuery.data.movements.length === 0 && (
        <div className="rounded-xl border border-dashed border-stone-300 bg-white p-8 text-center text-stone-600">
          Nenhum lançamento em {formatMonth(month)}.
          {isCurrentMonth && (
            <>
              {' '}
              Começando agora? Registre o dinheiro que já existe em{' '}
              <Link to="/financeiro/ajuste/novo" className={linkClass}>
                Ajustar saldo
              </Link>{' '}
              (motivo: saldo inicial).
            </>
          )}
        </div>
      )}

      {movementsQuery.data && movementsQuery.data.movements.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-stone-200 bg-stone-50 text-stone-600">
              <tr>
                <th className="px-4 py-3 font-medium">Data</th>
                <th className="px-4 py-3 font-medium">Descrição</th>
                <th className="px-4 py-3 font-medium">Conta</th>
                <th className="px-4 py-3 text-right font-medium">Valor</th>
                <th className="px-4 py-3">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {movementsQuery.data.movements.map((movement) => {
                const { title, detail } = movementLabel(movement);
                const amount = amountDisplay(movement);
                const editable = movement.type === 'income' || movement.type === 'expense';
                return (
                  <tr key={`${movement.type}-${movement.id}`}>
                    <td className="px-4 py-3 whitespace-nowrap text-stone-600 tabular-nums">
                      {formatDate(movement.occurredOn)}
                    </td>
                    <td className="px-4 py-3">
                      {editable ? (
                        <Link to={`/financeiro/lancamentos/${movement.id}`} className={linkClass}>
                          {title}
                        </Link>
                      ) : (
                        <span className="text-stone-800">{title}</span>
                      )}
                      <div className="text-xs text-stone-500">
                        {detail}
                        {movement.createdByName && ` · ${movement.createdByName}`}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-stone-600">
                      {movement.type === 'transfer' ? '—' : accountShortLabels[movement.account]}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-medium whitespace-nowrap tabular-nums ${amount.className}`}
                    >
                      {amount.text}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => confirmDelete(movement)}
                        disabled={deleteMutation.isPending}
                        aria-label={`Excluir ${title}`}
                        className="rounded px-2 py-1 text-stone-400 hover:bg-red-50 hover:text-red-700"
                      >
                        Excluir
                      </button>
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

function StatCard({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: number | undefined;
  strong?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${strong ? 'border-brand-200 bg-brand-50' : 'border-stone-200 bg-white'}`}
    >
      <p className="text-sm text-stone-600">{label}</p>
      <p
        className={`mt-1 text-2xl font-semibold tabular-nums ${
          value !== undefined && value < 0 ? 'text-red-700' : 'text-brand-900'
        }`}
      >
        {value === undefined ? '…' : formatCents(value)}
      </p>
    </div>
  );
}
