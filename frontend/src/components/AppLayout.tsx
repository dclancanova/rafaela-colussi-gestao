import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, NavLink, Outlet, useNavigate } from 'react-router';
import { logout } from '../features/auth/auth-api';
import { currentUserKey, useCurrentUser } from '../features/auth/use-current-user';

/** Links do menu, na ordem em que aparecem. */
const navItems = [
  { to: '/insumos', label: 'Insumos' },
  { to: '/fichas-tecnicas', label: 'Fichas técnicas' },
  { to: '/produtos', label: 'Produtos' },
  { to: '/configuracoes', label: 'Configurações' },
];

/** Moldura das páginas internas: cabeçalho com o nome da usuária e o botão de sair. */
export function AppLayout() {
  const { data: user } = useCurrentUser();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const logoutMutation = useMutation({
    mutationFn: logout,
    onSettled: () => {
      // Mesmo se a chamada falhar, a tela não deve continuar mostrando dados de quem saiu.
      queryClient.clear();
      queryClient.setQueryData(currentUserKey, null);
      navigate('/login', { replace: true });
    },
  });

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <nav className="flex items-center gap-6">
            <Link to="/" className="font-semibold text-brand-900">
              Rafaela Colussi
            </Link>
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `text-sm ${isActive ? 'font-medium text-brand-800' : 'text-stone-600 hover:text-stone-900'}`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-stone-600">{user?.name}</span>
            <button
              type="button"
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
              className="rounded-lg px-3 py-1.5 text-stone-700 hover:bg-stone-100 disabled:opacity-60"
            >
              Sair
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
