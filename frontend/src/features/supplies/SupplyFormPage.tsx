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
import { errorMessage } from '../../lib/error-message';
import { centsToInput, parseMoneyToCents } from '../../lib/money';
import {
  createSupply,
  getSupply,
  suppliesKeys,
  updateSupply,
  type MeasurementUnit,
  type Supply,
  type SupplyInput,
  type SupplyKind,
} from './supplies-api';
import { formatUnitCost, kindLabels, unitLabels } from './supply-format';

/** Os campos como texto, do jeito que estão nos inputs; a conversão acontece ao salvar. */
type FormValues = {
  name: string;
  kind: SupplyKind;
  unit: MeasurementUnit;
  packageQuantity: string;
  packagePrice: string;
  notes: string;
};

const emptyValues: FormValues = {
  name: '',
  kind: 'ingredient',
  unit: 'g',
  packageQuantity: '',
  packagePrice: '',
  notes: '',
};

function valuesFromSupply(supply: Supply): FormValues {
  return {
    name: supply.name,
    kind: supply.kind,
    unit: supply.unit,
    packageQuantity: String(supply.packageQuantity),
    packagePrice: centsToInput(supply.packagePriceCents),
    notes: supply.notes ?? '',
  };
}

/** Converte e confere os campos. Devolve o que vai para a API, ou a mensagem do primeiro problema. */
function toInput(values: FormValues): { input: SupplyInput } | { error: string } {
  if (!values.name.trim()) return { error: 'Informe o nome.' };

  const packageQuantity = Number(values.packageQuantity);
  if (!Number.isInteger(packageQuantity) || packageQuantity <= 0) {
    return { error: 'A quantidade da embalagem deve ser um número inteiro maior que zero.' };
  }

  const packagePriceCents = parseMoneyToCents(values.packagePrice);
  if (packagePriceCents === null) {
    return { error: 'Preço inválido. Use vírgula para os centavos, como em 6,50.' };
  }

  return {
    input: {
      name: values.name.trim(),
      kind: values.kind,
      unit: values.unit,
      packageQuantity,
      packagePriceCents,
      notes: values.notes.trim() || null,
    },
  };
}

/** Uma página para criar (/insumos/novo) e editar (/insumos/:id). */
export function SupplyFormPage() {
  const { id } = useParams();
  const supplyId = id === undefined ? null : Number(id);

  const supplyQuery = useQuery({
    queryKey: suppliesKeys.detail(supplyId ?? 0),
    queryFn: () => getSupply(supplyId!),
    enabled: supplyId !== null,
  });

  if (supplyId === null) return <SupplyForm supply={null} />;
  if (supplyQuery.isPending) return <p className="text-stone-600">Carregando…</p>;
  if (supplyQuery.isError) {
    return (
      <div className="space-y-3">
        <ErrorAlert>{errorMessage(supplyQuery.error)}</ErrorAlert>
        <Link to="/insumos" className={linkClass}>
          Voltar para os insumos
        </Link>
      </div>
    );
  }
  // "key" recria o formulário se o insumo mudar, para os campos começarem com os valores certos.
  return <SupplyForm key={supplyQuery.data.id} supply={supplyQuery.data} />;
}

function SupplyForm({ supply }: { supply: Supply | null }) {
  const [values, setValues] = useState<FormValues>(supply ? valuesFromSupply(supply) : emptyValues);
  const [formError, setFormError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const onSaved = async () => {
    // Listas e detalhes de insumos ficam desatualizados: o próximo acesso busca de novo.
    await queryClient.invalidateQueries({ queryKey: suppliesKeys.all });
    navigate('/insumos');
  };

  const saveMutation = useMutation({
    mutationFn: (input: SupplyInput) => (supply ? updateSupply(supply.id, input) : createSupply(input)),
    onSuccess: onSaved,
  });

  const archiveMutation = useMutation({
    mutationFn: (isActive: boolean) => updateSupply(supply!.id, { isActive }),
    onSuccess: onSaved,
  });

  function setField<K extends keyof FormValues>(field: K, value: FormValues[K]) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = toInput(values);
    if ('error' in result) {
      setFormError(result.error);
      return;
    }
    setFormError(null);
    saveMutation.mutate(result.input);
  }

  // Prévia do custo enquanto digita, com a mesma conta da API (preço ÷ quantidade).
  const preview = toInput(values);
  const previewCost =
    'input' in preview
      ? formatUnitCost(preview.input.packagePriceCents / preview.input.packageQuantity, preview.input.unit)
      : null;

  const busy = saveMutation.isPending || archiveMutation.isPending;
  const mutationError = saveMutation.error ?? archiveMutation.error;
  const shownError = formError ?? (mutationError ? errorMessage(mutationError) : null);

  return (
    <section className="max-w-xl space-y-6">
      <div>
        <Link to="/insumos" className={`text-sm ${linkClass}`}>
          ← Insumos
        </Link>
        <h1 className="mt-1 text-2xl font-semibold text-brand-900">{supply ? supply.name : 'Novo insumo'}</h1>
        {supply && !supply.isActive && (
          <p className="text-sm text-stone-500">Arquivado: não aparece na lista principal.</p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 rounded-xl border border-stone-200 bg-white p-6">
        {shownError && <ErrorAlert>{shownError}</ErrorAlert>}

        <div className="space-y-1">
          <label htmlFor="name" className={labelClass}>
            Nome
          </label>
          <input
            id="name"
            required
            maxLength={120}
            value={values.name}
            onChange={(event) => setField('name', event.target.value)}
            className={inputClass}
          />
        </div>

        <fieldset className="space-y-1">
          <legend className={labelClass}>Tipo</legend>
          <div className="flex gap-4 pt-1">
            {(Object.keys(kindLabels) as SupplyKind[]).map((kind) => (
              <label key={kind} className="flex items-center gap-2 text-sm text-stone-700">
                <input
                  type="radio"
                  name="kind"
                  value={kind}
                  checked={values.kind === kind}
                  onChange={() => setField('kind', kind)}
                />
                {kindLabels[kind]}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="unit" className={labelClass}>
              Unidade
            </label>
            <select
              id="unit"
              value={values.unit}
              onChange={(event) => setField('unit', event.target.value as MeasurementUnit)}
              className={inputClass}
            >
              {(Object.keys(unitLabels) as MeasurementUnit[]).map((unit) => (
                <option key={unit} value={unit}>
                  {unitLabels[unit]}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label htmlFor="packageQuantity" className={labelClass}>
              Quantidade na embalagem ({values.unit})
            </label>
            <input
              id="packageQuantity"
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              required
              placeholder={values.unit === 'g' ? 'ex.: 1000' : undefined}
              value={values.packageQuantity}
              onChange={(event) => setField('packageQuantity', event.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        <div className="space-y-1">
          <label htmlFor="packagePrice" className={labelClass}>
            Preço pago pela embalagem (R$)
          </label>
          <input
            id="packagePrice"
            inputMode="decimal"
            required
            placeholder="ex.: 6,50"
            value={values.packagePrice}
            onChange={(event) => setField('packagePrice', event.target.value)}
            className={inputClass}
          />
          <p className="text-sm text-stone-500" aria-live="polite">
            {previewCost ? `Custo: ${previewCost}` : 'Preencha quantidade e preço para ver o custo.'}
          </p>
        </div>

        <div className="space-y-1">
          <label htmlFor="notes" className={labelClass}>
            Observações <span className="font-normal text-stone-500">(opcional)</span>
          </label>
          <textarea
            id="notes"
            rows={3}
            maxLength={1000}
            placeholder="Marca, fornecedor…"
            value={values.notes}
            onChange={(event) => setField('notes', event.target.value)}
            className={inputClass}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={busy} className={primaryActionClass}>
            {saveMutation.isPending ? 'Salvando…' : 'Salvar'}
          </button>
          <Link to="/insumos" className={secondaryActionClass}>
            Cancelar
          </Link>
          {supply && (
            <button
              type="button"
              disabled={busy}
              onClick={() => archiveMutation.mutate(!supply.isActive)}
              className={`${secondaryActionClass} ml-auto`}
            >
              {supply.isActive ? 'Arquivar' : 'Reativar'}
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
