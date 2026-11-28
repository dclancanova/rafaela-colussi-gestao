import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { ErrorAlert } from '../../components/AuthCard';
import { inputClass, labelClass, primaryActionClass } from '../../components/form-styles';
import { errorMessage } from '../../lib/error-message';
import { basisPointsToInput, parsePercentToBasisPoints } from '../../lib/percent';
import { invalidateCatalog } from '../catalog/invalidate-catalog';
import {
  getPricingSettings,
  pricingSettingsKey,
  updatePricingSettings,
  type PricingSettings,
} from './pricing-settings-api';

export function PricingSettingsPage() {
  const settingsQuery = useQuery({ queryKey: pricingSettingsKey, queryFn: getPricingSettings });

  if (settingsQuery.isError) return <ErrorAlert>{errorMessage(settingsQuery.error)}</ErrorAlert>;
  if (!settingsQuery.data) return <p className="text-stone-600">Carregando…</p>;
  return <PricingSettingsForm settings={settingsQuery.data} />;
}

function PricingSettingsForm({ settings }: { settings: PricingSettings }) {
  const [indirect, setIndirect] = useState(basisPointsToInput(settings.indirectCostBasisPoints));
  const [target, setTarget] = useState(basisPointsToInput(settings.targetMarginBasisPoints));
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const queryClient = useQueryClient();

  const saveMutation = useMutation({
    mutationFn: updatePricingSettings,
    onSuccess: async () => {
      // Muda custo total, margem e preço sugerido de todos os produtos.
      await invalidateCatalog(queryClient);
      setSaved(true);
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaved(false);
    const indirectCostBasisPoints = parsePercentToBasisPoints(indirect);
    const targetMarginBasisPoints = parsePercentToBasisPoints(target);
    if (indirectCostBasisPoints === null || targetMarginBasisPoints === null) {
      setFormError('Percentual inválido. Use números como 20 ou 20,5.');
      return;
    }
    if (targetMarginBasisPoints > 9500) {
      setFormError('A margem-alvo pode ser no máximo 95%.');
      return;
    }
    setFormError(null);
    saveMutation.mutate({ indirectCostBasisPoints, targetMarginBasisPoints });
  }

  const shownError = formError ?? (saveMutation.isError ? errorMessage(saveMutation.error) : null);

  return (
    <section className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-brand-900">Configurações de preço</h1>
        <p className="text-sm text-stone-600">Valem para todos os produtos.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 rounded-xl border border-stone-200 bg-white p-6">
        {shownError && <ErrorAlert>{shownError}</ErrorAlert>}
        {saved && (
          <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            Configurações salvas. Os custos e margens dos produtos já foram atualizados.
          </p>
        )}

        <div className="space-y-1">
          <label htmlFor="indirect" className={labelClass}>
            Custos indiretos (%)
          </label>
          <input
            id="indirect"
            inputMode="decimal"
            required
            value={indirect}
            onChange={(event) => setIndirect(event.target.value)}
            className={`${inputClass} max-w-32`}
          />
          <p className="text-sm text-stone-500">
            Gás, energia, mão de obra, taxas de cartão e aplicativos, somados ao custo das fichas. Ex.: com
            20%, uma ficha de R$ 50,00 passa a custar R$ 60,00.
          </p>
        </div>

        <div className="space-y-1">
          <label htmlFor="target" className={labelClass}>
            Margem-alvo (%)
          </label>
          <input
            id="target"
            inputMode="decimal"
            required
            value={target}
            onChange={(event) => setTarget(event.target.value)}
            className={`${inputClass} max-w-32`}
          />
          <p className="text-sm text-stone-500">
            Quanto de cada venda vocês querem que sobre como lucro. Usada para sugerir preços e colorir as
            margens. Ex.: com 60%, um produto de custo total R$ 40,00 tem preço sugerido de R$ 100,00.
          </p>
        </div>

        <button type="submit" disabled={saveMutation.isPending} className={primaryActionClass}>
          {saveMutation.isPending ? 'Salvando…' : 'Salvar'}
        </button>
      </form>
    </section>
  );
}
