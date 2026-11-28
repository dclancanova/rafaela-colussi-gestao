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
import { accountLabels, createAdjustment, financeKeys, type Account } from './finance-api';

const reasonSuggestions = ['Saldo inicial', 'Conferência do caixa'];

/**
 * Ajuste de saldo (decisão BC): para registrar o saldo inicial e corrigir diferenças
 * (ex.: contou o caixa e tinha R$ 2,00 a menos). Fica fora dos relatórios de entradas e saídas.
 */
export function AdjustmentFormPage() {
  const [account, setAccount] = useState<Account>('cash');
  const [direction, setDirection] = useState<'increase' | 'decrease'>('increase');
  const [amount, setAmount] = useState('');
  const [occurredOn, setOccurredOn] = useState(todayIso());
  const [reason, setReason] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const saveMutation = useMutation({
    mutationFn: createAdjustment,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: financeKeys.all });
      navigate(`/financeiro?mes=${occurredOn.slice(0, 7)}`);
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cents = parseMoneyToCents(amount);
    if (cents === null || cents <= 0) {
      return setFormError('Valor inválido. Use vírgula para os centavos, como em 350,00.');
    }
    if (!reason.trim()) return setFormError('Informe o motivo.');
    if (occurredOn > todayIso()) return setFormError('A data não pode ser no futuro.');
    setFormError(null);
    // A API recebe o valor com sinal: negativo diminui o saldo.
    saveMutation.mutate({
      account,
      amountCents: direction === 'increase' ? cents : -cents,
      occurredOn,
      reason: reason.trim(),
    });
  }

  const shownError = formError ?? (saveMutation.isError ? errorMessage(saveMutation.error) : null);

  return (
    <section className="max-w-xl space-y-6">
      <div>
        <Link to="/financeiro" className={`text-sm ${linkClass}`}>
          ← Financeiro
        </Link>
        <h1 className="mt-1 text-2xl font-semibold text-brand-900">Ajustar saldo</h1>
        <p className="text-sm text-stone-600">
          Para registrar o saldo inicial de cada conta ou corrigir uma diferença na conferência. Não entra nos
          totais de entradas e saídas.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 rounded-xl border border-stone-200 bg-white p-6">
        {shownError && <ErrorAlert>{shownError}</ErrorAlert>}

        <fieldset className="space-y-1">
          <legend className={labelClass}>Conta</legend>
          <div className="flex flex-wrap gap-4 pt-1">
            {(Object.keys(accountLabels) as Account[]).map((option) => (
              <label key={option} className="flex items-center gap-2 text-sm text-stone-700">
                <input
                  type="radio"
                  name="account"
                  checked={account === option}
                  onChange={() => setAccount(option)}
                />
                {accountLabels[option]}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="space-y-1">
          <legend className={labelClass}>O saldo deve</legend>
          <div className="flex flex-wrap gap-4 pt-1">
            <label className="flex items-center gap-2 text-sm text-stone-700">
              <input
                type="radio"
                name="direction"
                checked={direction === 'increase'}
                onChange={() => setDirection('increase')}
              />
              Aumentar
            </label>
            <label className="flex items-center gap-2 text-sm text-stone-700">
              <input
                type="radio"
                name="direction"
                checked={direction === 'decrease'}
                onChange={() => setDirection('decrease')}
              />
              Diminuir
            </label>
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
              placeholder="ex.: 350,00"
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
          <label htmlFor="reason" className={labelClass}>
            Motivo
          </label>
          <input
            id="reason"
            required
            maxLength={200}
            list="reason-suggestions"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className={inputClass}
          />
          <datalist id="reason-suggestions">
            {reasonSuggestions.map((suggestion) => (
              <option key={suggestion} value={suggestion} />
            ))}
          </datalist>
          <div className="flex flex-wrap gap-2 pt-1">
            {reasonSuggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => setReason(suggestion)}
                className="rounded-full border border-stone-300 px-3 py-0.5 text-xs text-stone-600 hover:bg-stone-50"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button type="submit" disabled={saveMutation.isPending} className={primaryActionClass}>
            {saveMutation.isPending ? 'Salvando…' : 'Salvar ajuste'}
          </button>
          <Link to="/financeiro" className={secondaryActionClass}>
            Cancelar
          </Link>
        </div>
      </form>
    </section>
  );
}
