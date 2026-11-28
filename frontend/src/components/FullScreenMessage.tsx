import type { ReactNode } from 'react';

/** Mensagem centralizada na tela (carregando, erro de conexão…). */
export function FullScreenMessage({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-rose-50 px-4">
      <p className="text-center text-stone-600">{children}</p>
    </main>
  );
}
