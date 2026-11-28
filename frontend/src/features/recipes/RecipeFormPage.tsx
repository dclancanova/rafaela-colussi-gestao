import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState, type FormEvent } from 'react';
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
import { formatCents } from '../../lib/money';
import { formatUnitCost, parseQuantity, unitLabels, type MeasurementUnit } from '../../lib/units';
import { listSupplies, suppliesKeys, type Supply } from '../supplies/supplies-api';
import {
  emptyFormValues,
  newItemRow,
  parseComponent,
  previewTotalCents,
  rowCostCents,
  rowUnit,
  toRecipeInput,
  valuesFromRecipe,
  type CostSources,
  type ItemRow,
  type RecipeFormValues,
} from './recipe-form';
import {
  createRecipe,
  getRecipe,
  listRecipes,
  recipesKeys,
  updateRecipe,
  type RecipeDetail,
  type RecipeInput,
  type RecipeSummary,
} from './recipes-api';

/** Uma página para criar (/fichas-tecnicas/nova) e editar (/fichas-tecnicas/:id). */
export function RecipeFormPage() {
  const { id } = useParams();
  const recipeId = id === undefined ? null : Number(id);

  // Opções do seletor de itens. "all": itens arquivados já usados na ficha também precisam do nome.
  const suppliesQuery = useQuery({
    queryKey: suppliesKeys.list({ status: 'all' }),
    queryFn: () => listSupplies({ status: 'all' }),
  });
  const recipesQuery = useQuery({
    queryKey: recipesKeys.list('all'),
    queryFn: () => listRecipes('all'),
  });
  const recipeQuery = useQuery({
    queryKey: recipesKeys.detail(recipeId ?? 0),
    queryFn: () => getRecipe(recipeId!),
    enabled: recipeId !== null,
  });

  const error = suppliesQuery.error ?? recipesQuery.error ?? recipeQuery.error;
  if (error) {
    return (
      <div className="space-y-3">
        <ErrorAlert>{errorMessage(error)}</ErrorAlert>
        <Link to="/fichas-tecnicas" className={linkClass}>
          Voltar para as fichas técnicas
        </Link>
      </div>
    );
  }

  if (!suppliesQuery.data || !recipesQuery.data || (recipeId !== null && !recipeQuery.data)) {
    return <p className="text-stone-600">Carregando…</p>;
  }

  return (
    <RecipeForm
      key={recipeQuery.data?.id ?? 'nova'}
      recipe={recipeQuery.data ?? null}
      supplies={suppliesQuery.data}
      recipes={recipesQuery.data}
    />
  );
}

type RecipeFormProps = {
  recipe: RecipeDetail | null;
  supplies: Supply[];
  recipes: RecipeSummary[];
};

function RecipeForm({ recipe, supplies, recipes }: RecipeFormProps) {
  const [values, setValues] = useState<RecipeFormValues>(() =>
    recipe ? valuesFromRecipe(recipe) : emptyFormValues(),
  );
  const [formError, setFormError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const sources: CostSources = useMemo(
    () => ({
      supplies: new Map(supplies.map((supply) => [supply.id, supply])),
      recipes: new Map(recipes.map((item) => [item.id, item])),
    }),
    [supplies, recipes],
  );

  const onSaved = async () => {
    await queryClient.invalidateQueries({ queryKey: recipesKeys.all });
    navigate('/fichas-tecnicas');
  };

  const saveMutation = useMutation({
    mutationFn: (input: RecipeInput) => (recipe ? updateRecipe(recipe.id, input) : createRecipe(input)),
    onSuccess: onSaved,
  });

  const archiveMutation = useMutation({
    mutationFn: (isActive: boolean) => updateRecipe(recipe!.id, { isActive }),
    onSuccess: onSaved,
  });

  function setField<K extends keyof RecipeFormValues>(field: K, value: RecipeFormValues[K]) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function updateRow(key: number, changes: Partial<ItemRow>) {
    setValues((current) => ({
      ...current,
      items: current.items.map((row) => (row.key === key ? { ...row, ...changes } : row)),
    }));
  }

  function removeRow(key: number) {
    setValues((current) => ({ ...current, items: current.items.filter((row) => row.key !== key) }));
  }

  function addRow() {
    setValues((current) => ({ ...current, items: [...current.items, newItemRow()] }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = toRecipeInput(values);
    if ('error' in result) {
      setFormError(result.error);
      return;
    }
    setFormError(null);
    saveMutation.mutate(result.input);
  }

  // Prévia com a mesma conta da API: soma das linhas; por unidade = total ÷ rendimento.
  const total = previewTotalCents(values.items, sources);
  const yieldQuantity = parseQuantity(values.yieldQuantity);
  const perUnit = yieldQuantity ? formatUnitCost(total / yieldQuantity, values.yieldUnit) : null;

  // Decisão AP: quem usa esta ficha mede na unidade atual do rendimento; o backend recusa a troca.
  const yieldUnitLocked = (recipe?.usedIn.length ?? 0) > 0;
  const busy = saveMutation.isPending || archiveMutation.isPending;
  const mutationError = saveMutation.error ?? archiveMutation.error;
  const shownError = formError ?? (mutationError ? errorMessage(mutationError) : null);

  return (
    <section className="max-w-3xl space-y-6">
      <div>
        <Link to="/fichas-tecnicas" className={`text-sm ${linkClass}`}>
          ← Fichas técnicas
        </Link>
        <h1 className="mt-1 text-2xl font-semibold text-brand-900">
          {recipe ? recipe.name : 'Nova ficha técnica'}
        </h1>
        {recipe && !recipe.isActive && (
          <p className="text-sm text-stone-500">Arquivada: não aparece na lista principal.</p>
        )}
        {recipe && recipe.usedIn.length > 0 && (
          <p className="text-sm text-stone-600">
            Usada em:{' '}
            {recipe.usedIn.map((parent, index) => (
              <span key={parent.id}>
                {index > 0 && ', '}
                <Link to={`/fichas-tecnicas/${parent.id}`} className={linkClass}>
                  {parent.name}
                </Link>
              </span>
            ))}
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 rounded-xl border border-stone-200 bg-white p-6">
        {shownError && <ErrorAlert>{shownError}</ErrorAlert>}

        <div className="space-y-1">
          <label htmlFor="name" className={labelClass}>
            Nome
          </label>
          <input
            id="name"
            required
            maxLength={120}
            placeholder="ex.: Recheio de brigadeiro"
            value={values.name}
            onChange={(event) => setField('name', event.target.value)}
            className={inputClass}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="yieldQuantity" className={labelClass}>
              Rende
            </label>
            <input
              id="yieldQuantity"
              inputMode="decimal"
              required
              placeholder="ex.: 1 ou 1.200"
              value={values.yieldQuantity}
              onChange={(event) => setField('yieldQuantity', event.target.value)}
              className={inputClass}
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="yieldUnit" className={labelClass}>
              Unidade do rendimento
            </label>
            <select
              id="yieldUnit"
              value={values.yieldUnit}
              disabled={yieldUnitLocked}
              onChange={(event) => setField('yieldUnit', event.target.value as MeasurementUnit)}
              className={`${inputClass} disabled:bg-stone-100`}
            >
              {(Object.keys(unitLabels) as MeasurementUnit[]).map((unit) => (
                <option key={unit} value={unit}>
                  {unitLabels[unit]}
                </option>
              ))}
            </select>
            {yieldUnitLocked && (
              <p className="text-xs text-stone-500">Não pode mudar: outras fichas usam esta nesta unidade.</p>
            )}
          </div>
        </div>

        <fieldset className="space-y-3">
          <legend className={labelClass}>Itens</legend>
          <p className="text-sm text-stone-500">
            Insumos ou outras fichas técnicas (sub-receitas). A quantidade de uma sub-receita é na unidade do
            rendimento dela.
          </p>

          {values.items.map((row, index) => (
            <ItemRowFields
              key={row.key}
              row={row}
              index={index}
              rows={values.items}
              currentRecipeId={recipe?.id ?? null}
              supplies={supplies}
              recipes={recipes}
              sources={sources}
              onChange={(changes) => updateRow(row.key, changes)}
              onRemove={() => removeRow(row.key)}
            />
          ))}

          <button type="button" onClick={addRow} className={`${secondaryActionClass} text-sm`}>
            + Adicionar item
          </button>
        </fieldset>

        <div className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg bg-brand-50 px-4 py-3">
          <span className="text-sm text-stone-700">Custo total</span>
          <span className="text-right" aria-live="polite">
            <span className="text-lg font-semibold text-brand-900 tabular-nums">{formatCents(total)}</span>
            {perUnit && <span className="ml-2 text-sm text-stone-600">({perUnit})</span>}
          </span>
        </div>

        <div className="space-y-1">
          <label htmlFor="notes" className={labelClass}>
            Modo de preparo / observações <span className="font-normal text-stone-500">(opcional)</span>
          </label>
          <textarea
            id="notes"
            rows={4}
            maxLength={2000}
            value={values.notes}
            onChange={(event) => setField('notes', event.target.value)}
            className={inputClass}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={busy} className={primaryActionClass}>
            {saveMutation.isPending ? 'Salvando…' : 'Salvar'}
          </button>
          <Link to="/fichas-tecnicas" className={secondaryActionClass}>
            Cancelar
          </Link>
          {recipe && (
            <button
              type="button"
              disabled={busy}
              onClick={() => archiveMutation.mutate(!recipe.isActive)}
              className={`${secondaryActionClass} ml-auto`}
            >
              {recipe.isActive ? 'Arquivar' : 'Reativar'}
            </button>
          )}
        </div>
      </form>
    </section>
  );
}

type ItemRowFieldsProps = {
  row: ItemRow;
  index: number;
  rows: ItemRow[];
  currentRecipeId: number | null;
  supplies: Supply[];
  recipes: RecipeSummary[];
  sources: CostSources;
  onChange: (changes: Partial<ItemRow>) => void;
  onRemove: () => void;
};

function ItemRowFields({
  row,
  index,
  rows,
  currentRecipeId,
  supplies,
  recipes,
  sources,
  onChange,
  onRemove,
}: ItemRowFieldsProps) {
  // Item já escolhido em outra linha fica desabilitado (o backend também recusa repetição).
  const takenElsewhere = new Set(
    rows.filter((other) => other.key !== row.key).map((other) => other.component),
  );
  // Arquivados só aparecem se já estiverem nesta linha (fichas antigas continuam editáveis).
  const visibleSupplies = supplies.filter((supply) => supply.isActive || row.component === `s:${supply.id}`);
  const visibleRecipes = recipes.filter(
    (item) => item.id !== currentRecipeId && (item.isActive || row.component === `r:${item.id}`),
  );

  const unit = rowUnit(row, sources);
  const cost = rowCostCents(row, sources);
  const selected = parseComponent(row.component);
  const selectedIsArchived =
    selected?.kind === 'supply'
      ? supplies.find((supply) => supply.id === selected.id)?.isActive === false
      : selected?.kind === 'recipe'
        ? recipes.find((item) => item.id === selected.id)?.isActive === false
        : false;

  const line = index + 1;

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
        <select
          aria-label={`Item da linha ${line}`}
          value={row.component}
          onChange={(event) => onChange({ component: event.target.value })}
          className={`${inputClass} min-w-0 flex-1`}
        >
          <option value="">Escolha um item…</option>
          <optgroup label="Insumos">
            {visibleSupplies.map((supply) => (
              <option
                key={supply.id}
                value={`s:${supply.id}`}
                disabled={takenElsewhere.has(`s:${supply.id}`)}
              >
                {supply.name} ({supply.unit}){supply.isActive ? '' : ' — arquivado'}
              </option>
            ))}
          </optgroup>
          {visibleRecipes.length > 0 && (
            <optgroup label="Fichas técnicas">
              {visibleRecipes.map((item) => (
                <option key={item.id} value={`r:${item.id}`} disabled={takenElsewhere.has(`r:${item.id}`)}>
                  {item.name} ({item.yieldUnit}){item.isActive ? '' : ' — arquivada'}
                </option>
              ))}
            </optgroup>
          )}
        </select>

        <div className="flex items-center gap-1">
          <input
            aria-label={`Quantidade da linha ${line}`}
            inputMode="decimal"
            placeholder="Qtd."
            value={row.quantity}
            onChange={(event) => onChange({ quantity: event.target.value })}
            className={`${inputClass} w-24 text-right`}
          />
          <span className="w-6 text-sm text-stone-500">{unit ?? ''}</span>
        </div>

        <span className="w-24 text-right text-sm text-stone-700 tabular-nums">
          {cost === null ? '—' : formatCents(cost)}
        </span>

        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remover a linha ${line}`}
          className="rounded-lg px-2 py-1 text-stone-500 hover:bg-stone-100 hover:text-stone-800"
        >
          ×
        </button>
      </div>
      {selectedIsArchived && (
        <p className="text-xs text-amber-700">
          Arquivado: continua contando no custo, mas considere substituir.
        </p>
      )}
    </div>
  );
}
