// Classes do Tailwind repetidas nos formulários (num arquivo .ts à parte porque arquivos
// de componente só devem exportar componentes, para o recarregamento rápido do Vite funcionar).

export const labelClass = 'block text-sm font-medium text-stone-700';

export const inputClass =
  'w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-rose-400 focus:ring-2 focus:ring-rose-200 focus:outline-none';

export const primaryButtonClass =
  'w-full rounded-lg bg-rose-700 px-4 py-2 font-medium text-white hover:bg-rose-800 disabled:opacity-60';

export const linkClass = 'font-medium text-rose-700 hover:text-rose-900 hover:underline';
