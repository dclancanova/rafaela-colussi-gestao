import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { ErrorAlert } from '../../components/AuthCard';
import {
  inputClass,
  labelClass,
  linkClass,
  primaryActionClass,
  secondaryActionClass,
} from '../../components/form-styles';
import { todayIso } from '../../lib/dates';
import { errorMessage } from '../../lib/error-message';
import { parseMoneyToCents } from '../../lib/money';
import { accountLabels, createTransfer, financeKeys, type Account } from './finance-api';

/** Dinheiro mudando de lugar, ex.: depositar o dinheiro do caixa na conta. Não é entrada nem saída. */
export function TransferFormPage() {
  const [fromAccount, setFromAccount] = useState<Account>('cash');
  const [amount, setAmount] = useState('');
  const [occurredOn, setOccurredOn] = useState(todayIso());
  const [description, setDescription] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Só existem duas contas: o destino é sempre a outra.
  const toAccount: Account = fromAccount === 'cash' ? 'bank' : 'cash';

  const saveMutation = useMutation({
    mutationFn: createTransfer,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: financeKeys.all });
      navigate(`/financeiro?mes=${occurredOn.slice(0, 7)}`);
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amountCents = parseMoneyToCents(amount);
    if (amountCents === null || amountCents <= 0) {
      return setFormError('Valor inválido. Use vírgula para os centavos, como em 200,00.');
    }
    if (occurredOn > todayIso()) return setFormError('A data não pode ser no futuro.');
    setFormError(null);
    saveMutation.mutate({
      fromAccount,
      toAccount,
      amountCents,
      occurredOn,
      description: description.trim() || null,
    });
  }

  const shownError = formError ?? (saveMutation.isError ? errorMessage(saveMutation.error) : null);

  return (
    <section className="max-w-xl space-y-6">
      <div>
        <Link to="/financeiro" className={`text-sm ${linkClass}`}>
          ← Financeiro
        </Link>
        <h1 className="mt-1 text-2xl font-semibold text-brand-900">Transferir entre contas</h1>
        <p className="text-sm text-stone-600">
          Ex.: depositar o dinheiro do caixa no banco. Muda os saldos, mas não conta como entrada nem saída.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 rounded-xl border border-stone-200 bg-white p-6">
        {shownError && <ErrorAlert>{shownError}</ErrorAlert>}

        <fieldset className="space-y-1">
          <legend className={labelClass}>Direção</legend>
          <div className="flex flex-col gap-2 pt-1">
            {(['cash', 'bank'] as Account[]).map((account) => (
              <label key={account} className="flex items-center gap-2 text-sm text-stone-700">
                <input
                  type="radio"
                  name="direction"
                  checked={fromAccount === account}
                  onChange={() => setFromAccount(account)}
                />
                De {accountLabels[account]} para {accountLabels[account === 'cash' ? 'bank' : 'cash']}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="amount" className={labelClass}>
              Valor (R$)
            </label>
            <input
              id="amount"
              inputMode="decimal"
              required
              placeholder="ex.: 200,00"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className={inputClass}
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="occurredOn" className={labelClass}>
              Data
            </label>
            <input
              id="occurredOn"
              type="date"
              required
              max={todayIso()}
              value={occurredOn}
              onChange={(event) => setOccurredOn(event.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        <div className="space-y-1">
          <label htmlFor="description" className={labelClass}>
            Observação <span className="font-normal text-stone-500">(opcional)</span>
          </label>
          <input
            id="description"
            maxLength={200}
            placeholder="ex.: Depósito da semana"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className={inputClass}
          />
        </div>

        <div className="flex flex-wrap gap-3">
          <button type="submit" disabled={saveMutation.isPending} className={primaryActionClass}>
            {saveMutation.isPending ? 'Salvando…' : 'Transferir'}
          </button>
          <Link to="/financeiro" className={secondaryActionClass}>
            Cancelar
          </Link>
        </div>
      </form>
    </section>
  );
}
