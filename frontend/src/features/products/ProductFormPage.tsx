import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent, type ReactNode } from 'react';
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
import { centsToInput, formatCents, parseMoneyToCents } from '../../lib/money';
import { formatBasisPoints, formatPercent } from '../../lib/percent';
import { marginLevel, marginLevelClass, previewPricing, type PricingSettings } from '../../lib/pricing';
import { parseQuantity, quantityToInput } from '../../lib/units';
import { invalidateCatalog } from '../catalog/invalidate-catalog';
import { listRecipes, recipesKeys, type RecipeSummary } from '../recipes/recipes-api';
import { getPricingSettings, pricingSettingsKey } from '../settings/pricing-settings-api';
import {
  createProduct,
  getProduct,
  productsKeys,
  updateProduct,
  type Product,
  type ProductInput,
} from './products-api';

type FormValues = {
  name: string;
  recipeId: string;
  recipeQuantity: string;
  price: string;
  notes: string;
};

function valuesFromProduct(product: Product | null): FormValues {
  if (!product) return { name: '', recipeId: '', recipeQuantity: '1', price: '', notes: '' };
  return {
    name: product.name,
    recipeId: String(product.recipe.id),
    recipeQuantity: quantityToInput(product.recipeQuantity),
    price: centsToInput(product.priceCents),
    notes: product.notes ?? '',
  };
}

function toInput(values: FormValues): { input: ProductInput } | { error: string } {
  if (!values.name.trim()) return { error: 'Informe o nome.' };
  const recipeId = Number(values.recipeId);
  if (!values.recipeId || !Number.isInteger(recipeId)) return { error: 'Escolha a ficha técnica.' };

  const recipeQuantity = parseQuantity(values.recipeQuantity);
  if (recipeQuantity === null || recipeQuantity <= 0) {
    return { error: 'Quantidade da ficha inválida. Use vírgula para decimais, como em 0,5.' };
  }

  const priceCents = parseMoneyToCents(values.price);
  if (priceCents === null) return { error: 'Preço inválido. Use vírgula para os centavos, como em 120,00.' };

  return {
    input: {
      name: values.name.trim(),
      recipeId,
      recipeQuantity,
      priceCents,
      notes: values.notes.trim() || null,
    },
  };
}

/** Uma página para criar (/produtos/novo) e editar (/produtos/:id). */
export function ProductFormPage() {
  const { id } = useParams();
  const productId = id === undefined ? null : Number(id);

  const recipesQuery = useQuery({ queryKey: recipesKeys.list('all'), queryFn: () => listRecipes('all') });
  const settingsQuery = useQuery({ queryKey: pricingSettingsKey, queryFn: getPricingSettings });
  const productQuery = useQuery({
    queryKey: productsKeys.detail(productId ?? 0),
    queryFn: () => getProduct(productId!),
    enabled: productId !== null,
  });

  const error = recipesQuery.error ?? settingsQuery.error ?? productQuery.error;
  if (error) {
    return (
      <div className="space-y-3">
        <ErrorAlert>{errorMessage(error)}</ErrorAlert>
        <Link to="/produtos" className={linkClass}>
          Voltar para os produtos
        </Link>
      </div>
    );
  }

  if (!recipesQuery.data || !settingsQuery.data || (productId !== null && !productQuery.data)) {
    return <p className="text-stone-600">Carregando…</p>;
  }

  return (
    <ProductForm
      key={productQuery.data?.id ?? 'novo'}
      product={productQuery.data ?? null}
      recipes={recipesQuery.data}
      settings={settingsQuery.data}
    />
  );
}

type ProductFormProps = {
  product: Product | null;
  recipes: RecipeSummary[];
  settings: PricingSettings;
};

function ProductForm({ product, recipes, settings }: ProductFormProps) {
  const [values, setValues] = useState<FormValues>(() => valuesFromProduct(product));
  const [formError, setFormError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const onSaved = async () => {
    await invalidateCatalog(queryClient);
    navigate('/produtos');
  };

  const saveMutation = useMutation({
    mutationFn: (input: ProductInput) => (product ? updateProduct(product.id, input) : createProduct(input)),
    onSuccess: onSaved,
  });

  const archiveMutation = useMutation({
    mutationFn: (isActive: boolean) => updateProduct(product!.id, { isActive }),
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

  // Arquivadas só aparecem se já forem a ficha deste produto.
  const recipeOptions = recipes.filter((recipe) => recipe.isActive || String(recipe.id) === values.recipeId);
  const selectedRecipe = recipes.find((recipe) => String(recipe.id) === values.recipeId);
  const quantity = parseQuantity(values.recipeQuantity);
  const priceCents = parseMoneyToCents(values.price) ?? 0;

  // Prévia com a mesma conta do backend; depois de salvar, vale o que a API calcular.
  const preview =
    selectedRecipe && quantity
      ? previewPricing(selectedRecipe.costPerYieldUnitCents * quantity, priceCents, settings)
      : null;
  const level = preview ? marginLevel(preview.marginRatio, settings.targetMarginBasisPoints) : null;

  const busy = saveMutation.isPending || archiveMutation.isPending;
  const mutationError = saveMutation.error ?? archiveMutation.error;
  const shownError = formError ?? (mutationError ? errorMessage(mutationError) : null);

  return (
    <section className="max-w-2xl space-y-6">
      <div>
        <Link to="/produtos" className={`text-sm ${linkClass}`}>
          ← Produtos
        </Link>
        <h1 className="mt-1 text-2xl font-semibold text-brand-900">
          {product ? product.name : 'Novo produto'}
        </h1>
        {product && !product.isActive && (
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
            placeholder="ex.: Cento de brigadeiros"
            value={values.name}
            onChange={(event) => setField('name', event.target.value)}
            className={inputClass}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
          <div className="space-y-1">
            <label htmlFor="recipeId" className={labelClass}>
              Ficha técnica
            </label>
            <select
              id="recipeId"
              required
              value={values.recipeId}
              onChange={(event) => setField('recipeId', event.target.value)}
              className={inputClass}
            >
              <option value="">Escolha a ficha…</option>
              {recipeOptions.map((recipe) => (
                <option key={recipe.id} value={recipe.id}>
                  {recipe.name}
                  {recipe.isActive ? '' : ' — arquivada'}
                </option>
              ))}
            </select>
            {recipes.length === 0 && (
              <p className="text-sm text-stone-500">
                Nenhuma ficha técnica ainda.{' '}
                <Link to="/fichas-tecnicas/nova" className={linkClass}>
                  Cadastrar uma
                </Link>
              </p>
            )}
          </div>

          <div className="space-y-1">
            <label htmlFor="recipeQuantity" className={labelClass}>
              Quantidade por venda
            </label>
            <div className="flex items-center gap-2">
              <input
                id="recipeQuantity"
                inputMode="decimal"
                required
                value={values.recipeQuantity}
                onChange={(event) => setField('recipeQuantity', event.target.value)}
                className={`${inputClass} w-28 text-right`}
              />
              <span className="w-6 text-sm text-stone-500">{selectedRecipe?.yieldUnit ?? ''}</span>
            </div>
          </div>
        </div>

        <div className="space-y-1">
          <label htmlFor="price" className={labelClass}>
            Preço de venda (R$)
          </label>
          <input
            id="price"
            inputMode="decimal"
            required
            placeholder="ex.: 120,00"
            value={values.price}
            onChange={(event) => setField('price', event.target.value)}
            className={`${inputClass} max-w-48`}
          />
        </div>

        {preview && (
          <dl className="space-y-1.5 rounded-lg bg-brand-50 px-4 py-3 text-sm" aria-live="polite">
            <PreviewRow label="Custo da ficha">{formatCents(preview.directCostCents)}</PreviewRow>
            <PreviewRow label={`Custos indiretos (${formatBasisPoints(settings.indirectCostBasisPoints)})`}>
              {formatCents(preview.indirectCostCents)}
            </PreviewRow>
            <PreviewRow label="Custo total" strong>
              {formatCents(preview.totalCostCents)}
            </PreviewRow>
            <div className="border-t border-brand-100 pt-1.5" />
            <PreviewRow label="Lucro" strong>
              {formatCents(preview.profitCents)}
            </PreviewRow>
            <PreviewRow label="Margem" strong className={level ? marginLevelClass[level] : ''}>
              {preview.marginRatio === null ? '—' : formatPercent(preview.marginRatio)}
              {level === 'loss' && ' (prejuízo)'}
              {level === 'below-target' && ' (abaixo da meta)'}
            </PreviewRow>
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <span className="text-stone-600">
                Preço sugerido para {formatBasisPoints(settings.targetMarginBasisPoints)} de margem:{' '}
                <strong className="text-stone-900 tabular-nums">
                  {formatCents(preview.suggestedPriceCents)}
                </strong>
              </span>
              <button
                type="button"
                onClick={() => setField('price', centsToInput(preview.suggestedPriceCents))}
                className="text-sm font-medium text-brand-700 hover:text-brand-900 hover:underline"
              >
                Usar preço sugerido
              </button>
            </div>
          </dl>
        )}

        <div className="space-y-1">
          <label htmlFor="notes" className={labelClass}>
            Observações <span className="font-normal text-stone-500">(opcional)</span>
          </label>
          <textarea
            id="notes"
            rows={3}
            maxLength={1000}
            value={values.notes}
            onChange={(event) => setField('notes', event.target.value)}
            className={inputClass}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={busy} className={primaryActionClass}>
            {saveMutation.isPending ? 'Salvando…' : 'Salvar'}
          </button>
          <Link to="/produtos" className={secondaryActionClass}>
            Cancelar
          </Link>
          {product && (
            <button
              type="button"
              disabled={busy}
              onClick={() => archiveMutation.mutate(!product.isActive)}
              className={`${secondaryActionClass} ml-auto`}
            >
              {product.isActive ? 'Arquivar' : 'Reativar'}
            </button>
          )}
        </div>
      </form>
    </section>
  );
}

function PreviewRow({
  label,
  children,
  strong = false,
  className = '',
}: {
  label: string;
  children: ReactNode;
  strong?: boolean;
  className?: string;
}) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-stone-600">{label}</dt>
      <dd
        className={`tabular-nums ${strong ? 'font-semibold text-stone-900' : 'text-stone-700'} ${className}`}
      >
        {children}
      </dd>
    </div>
  );
}
