// Classes do Tailwind repetidas nos formulários (num arquivo .ts à parte porque arquivos
// de componente só devem exportar componentes, para o recarregamento rápido do Vite funcionar).

export const labelClass = 'block text-sm font-medium text-stone-700';

export const inputClass =
  'w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-brand-400 focus:ring-2 focus:ring-brand-200 focus:outline-none';

export const primaryButtonClass =
  'w-full rounded-lg bg-brand-700 px-4 py-2 font-medium text-white hover:bg-brand-800 disabled:opacity-60';

export const linkClass = 'font-medium text-brand-700 hover:text-brand-900 hover:underline';
