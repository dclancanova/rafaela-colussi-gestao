import { useCurrentUser } from '../auth/use-current-user';

/** Página inicial provisória: vira o painel quando os módulos (pedidos, produção…) existirem. */
export function HomePage() {
  const { data: user } = useCurrentUser();

  return (
    <section className="space-y-2">
      <h1 className="text-2xl font-semibold text-brand-900">Olá, {user?.name}!</h1>
      <p className="text-stone-600">Os módulos da gestão vão aparecer aqui.</p>
    </section>
  );
}
