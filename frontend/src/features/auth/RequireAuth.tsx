import { Navigate, Outlet, useLocation } from 'react-router';
import { FullScreenMessage } from '../../components/FullScreenMessage';
import { useCurrentUser } from './use-current-user';

/** Protege as rotas internas: sem sessão, manda para o login lembrando de onde veio. */
export function RequireAuth() {
  const location = useLocation();
  const { data: user, isPending, isError } = useCurrentUser();

  if (isPending) return <FullScreenMessage>Carregando…</FullScreenMessage>;
  if (isError) {
    return <FullScreenMessage>Não foi possível conectar ao servidor. Recarregue a página.</FullScreenMessage>;
  }
  // pathname + search: volta para a mesma página com os mesmos filtros (ex.: /produtos?categoria=bolos).
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;

  return <Outlet />;
}
