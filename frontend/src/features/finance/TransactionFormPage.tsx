import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
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
import { centsToInput, parseMoneyToCents } from '../../lib/money';
import {
  accountLabels,
  createTransaction,
  financeKeys,
  getTransaction,
  listCategories,
  updateTransaction,
  type Account,
  type EntryKind,
  type FinanceCategory,
  type Transaction,
  type TransactionInput,
} from './finance-api';

const kindTitles: Record<EntryKind, { new: string; edit: string }> = {
  income: { new: 'Nova entrada', edit: 'Editar entrada' },
  expense: { new: 'Nova saída', edit: 'Editar saída' },
};

/**
 * Entrada ou saída: /financeiro/entrada/nova, /financeiro/saida/nova e /financeiro/lancamentos/:id (edição).
 * `kind` vem da rota nas páginas de criação; na edição, do próprio lançamento.
 */
export function TransactionFormPage({ kind }: { kind?: EntryKind }) {
  const { id } = useParams();
  const transactionId = id === undefined ? null : Number(id);

  // "all": um lançamento antigo pode estar numa categoria arquivada, que precisa aparecer com o nome.
  const categoriesQuery = useQuery({
    queryKey: financeKeys.categories('all'),
    queryFn: () => listCategories('all'),
  });
  const transactionQuery = useQuery({
    queryKey: financeKeys.transaction(transactionId ?? 0),
    queryFn: () => getTransaction(transactionId!),
    enabled: transactionId !== null,
  });

  const error = categoriesQuery.error ?? transactionQuery.error;
  if (error) {
    return (
      <div className="space-y-3">
        <ErrorAlert>{errorMessage(error)}</ErrorAlert>
        <Link to="/financeiro" className={linkClass}>
          Voltar para o financeiro
        </Link>
      </div>
    );
  }
  if (!categoriesQuery.data || (transactionId !== null && !transactionQuery.data)) {
    return <p className="text-stone-600">Carregando…</p>;
  }

  const transaction = transactionQuery.data ?? null;
  return (
    <TransactionForm
      key={transaction?.id ?? kind}
      kind={transaction?.kind ?? kind ?? 'income'}
      transaction={transaction}
      categories={categoriesQuery.data}
    />
  );
}

type FormValues = {
  account: Account;
  categoryId: string;
  amount: string;
  occurredOn: string;
  description: string;
};

function TransactionForm({
  kind,
  transaction,
  categories,
}: {
  kind: EntryKind;
  transaction: Transaction | null;
  categories: FinanceCategory[];
}) {
  const [values, setValues] = useState<FormValues>(() =>
    transaction
      ? {
          account: transaction.account,
          categoryId: String(transaction.categoryId),
          amount: centsToInput(transaction.amountCents),
          occurredOn: transaction.occurredOn,
          description: transaction.description,
        }
      : // Entradas costumam cair no Pix; saídas, sair do caixa. Só o ponto de partida: dá para trocar.
        {
          account: kind === 'income' ? 'bank' : 'cash',
          categoryId: '',
          amount: '',
          occurredOn: todayIso(),
          description: '',
        },
  );
  const [formError, setFormError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const saveMutation = useMutation({
    mutationFn: (input: TransactionInput) =>
      transaction ? updateTransaction(transaction.id, input) : createTransaction(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: financeKeys.all });
      // Volta para o mês do lançamento, para ele aparecer na lista.
      navigate(`/financeiro?mes=${values.occurredOn.slice(0, 7)}`);
    },
  });

  function setField<K extends keyof FormValues>(field: K, value: FormValues[K]) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amountCents = parseMoneyToCents(values.amount);
    if (!values.categoryId) return setFormError('Escolha a categoria.');
    if (amountCents === null || amountCents <= 0) {
      return setFormError('Valor inválido. Use vírgula para os centavos, como em 45,90.');
    }
    if (!values.description.trim()) return setFormError('Informe a descrição.');
    if (values.occurredOn > todayIso()) return setFormError('A data não pode ser no futuro.');

    setFormError(null);
    saveMutation.mutate({
      kind,
      account: values.account,
      categoryId: Number(values.categoryId),
      amountCents,
      occurredOn: values.occurredOn,
      description: values.description.trim(),
    });
  }

  // Só categorias do tipo certo; arquivadas só se já forem a deste lançamento.
  const options = categories.filter(
    (category) => category.kind === kind && (category.isActive || String(category.id) === values.categoryId),
  );
  const shownError = formError ?? (saveMutation.isError ? errorMessage(saveMutation.error) : null);
  const title = transaction ? kindTitles[kind].edit : kindTitles[kind].new;

  return (
    <section className="max-w-xl space-y-6">
      <div>
        <Link to="/financeiro" className={`text-sm ${linkClass}`}>
          ← Financeiro
        </Link>
        <h1 className="mt-1 text-2xl font-semibold text-brand-900">{title}</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 rounded-xl border border-stone-200 bg-white p-6">
        {shownError && <ErrorAlert>{shownError}</ErrorAlert>}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="amount" className={labelClass}>
              Valor (R$)
            </label>
            <input
              id="amount"
              inputMode="decimal"
              required
              autoFocus
              placeholder="ex.: 45,90"
              value={values.amount}
              onChange={(event) => setField('amount', event.target.value)}
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
              value={values.occurredOn}
              onChange={(event) => setField('occurredOn', event.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        <div className="space-y-1">
          <label htmlFor="description" className={labelClass}>
            Descrição
          </label>
          <input
            id="description"
            required
            maxLength={200}
            placeholder={kind === 'income' ? 'ex.: Encomenda bolo da Ana' : 'ex.: Compra no atacadão'}
            value={values.description}
            onChange={(event) => setField('description', event.target.value)}
            className={inputClass}
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="categoryId" className={labelClass}>
            Categoria
          </label>
          <select
            id="categoryId"
            required
            value={values.categoryId}
            onChange={(event) => setField('categoryId', event.target.value)}
            className={inputClass}
          >
            <option value="">Escolha a categoria…</option>
            {options.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
                {category.isActive ? '' : ' (arquivada)'}
              </option>
            ))}
          </select>
        </div>

        <fieldset className="space-y-1">
          <legend className={labelClass}>{kind === 'income' ? 'Entrou em' : 'Saiu de'}</legend>
          <div className="flex flex-wrap gap-4 pt-1">
            {(Object.keys(accountLabels) as Account[]).map((account) => (
              <label key={account} className="flex items-center gap-2 text-sm text-stone-700">
                <input
                  type="radio"
                  name="account"
                  checked={values.account === account}
                  onChange={() => setField('account', account)}
                />
                {accountLabels[account]}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-wrap gap-3">
          <button type="submit" disabled={saveMutation.isPending} className={primaryActionClass}>
            {saveMutation.isPending ? 'Salvando…' : 'Salvar'}
          </button>
          <Link to="/financeiro" className={secondaryActionClass}>
            Cancelar
          </Link>
        </div>
      </form>
    </section>
  );
}
