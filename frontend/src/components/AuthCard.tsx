import type { ReactNode } from 'react';
import { Monogram } from './Monogram';

/** Moldura das telas de acesso (login, esqueci a senha, redefinir senha), com o logo completo. */
export function AuthCard({ subtitle, children }: { subtitle: string; children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-brand-50 px-4">
      <div className="w-full max-w-sm space-y-5 rounded-2xl bg-white p-8 shadow-sm">
        {/* Mesma composição do logo: monograma, nome espaçado e "confeitaria artesanal" em itálico. */}
        <div className="flex flex-col items-center text-center">
          <Monogram className="h-16 w-16 text-framboesa" />
          <h1 className="mt-3 text-sm font-light tracking-[0.3em] text-framboesa uppercase">
            Rafaela Colussi
          </h1>
          <p className="font-serif text-lg text-cacau italic">confeitaria artesanal</p>
          <p className="mt-3 text-sm text-stone-500">{subtitle}</p>
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
