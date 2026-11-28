import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import { AuthCard, ErrorAlert } from '../../components/AuthCard';
import { FullScreenMessage } from '../../components/FullScreenMessage';
import { inputClass, labelClass, linkClass, primaryButtonClass } from '../../components/form-styles';
import { errorMessage } from '../../lib/error-message';
import { login } from './auth-api';
import { currentUserKey, useCurrentUser } from './use-current-user';

/** Para onde voltar depois do login: a página que pediu o login, ou o início. */
function redirectTarget(state: unknown): string {
  const from = (state as { from?: unknown } | null)?.from;
  // Só caminhos internos ("/algo"); "//site.com" levaria para fora do sistema.
  return typeof from === 'string' && from.startsWith('/') && !from.startsWith('//') ? from : '/';
}

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: currentUser, isPending: checkingSession } = useCurrentUser();

  const loginMutation = useMutation({
    mutationFn: login,
    onSuccess: ({ user }) => {
      // Já sabemos quem entrou: grava no cache em vez de chamar /me de novo.
      queryClient.setQueryData(currentUserKey, user);
      navigate(redirectTarget(location.state), { replace: true });
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    loginMutation.mutate({ email, password });
  }

  if (checkingSession) return <FullScreenMessage>Carregando…</FullScreenMessage>;
  // Quem já está logada e abre /login vai direto para dentro.
  if (currentUser) return <Navigate to="/" replace />;

  return (
    <AuthCard subtitle="Gestão interna">
      <form onSubmit={handleSubmit} className="space-y-5">
        {loginMutation.isError && <ErrorAlert>{errorMessage(loginMutation.error)}</ErrorAlert>}

        <div className="space-y-1">
          <label htmlFor="email" className={labelClass}>
            E-mail
          </label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={inputClass}
          />
        </div>

        <div className="space-y-1">
          <div className="flex items-baseline justify-between">
            <label htmlFor="password" className={labelClass}>
              Senha
            </label>
            <Link to="/esqueci-senha" className={`text-sm ${linkClass}`}>
              Esqueci minha senha
            </Link>
          </div>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={inputClass}
          />
        </div>

        <button type="submit" disabled={loginMutation.isPending} className={primaryButtonClass}>
          {loginMutation.isPending ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </AuthCard>
  );
}
