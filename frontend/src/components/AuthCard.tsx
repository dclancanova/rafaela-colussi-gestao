import type { ReactNode } from 'react';

/** Moldura das telas de acesso (login, esqueci a senha, redefinir senha). */
export function AuthCard({ subtitle, children }: { subtitle: string; children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-brand-50 px-4">
      <div className="w-full max-w-sm space-y-5 rounded-2xl bg-white p-8 shadow-sm">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-brand-900">Rafaela Colussi</h1>
          <p className="text-sm text-stone-500">{subtitle}</p>
        </div>
        {children}
      </div>
    </main>
  );
}

/** Mensagem de erro em destaque; role="alert" faz leitores de tela anunciarem. */
export function ErrorAlert({ children }: { children: ReactNode }) {
  return (
    <div role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
      {children}
    </div>
  );
}
