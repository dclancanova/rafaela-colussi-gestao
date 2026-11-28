import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { AuthCard, ErrorAlert } from '../../components/AuthCard';
import { inputClass, labelClass, linkClass, primaryButtonClass } from '../../components/form-styles';
import { ApiError } from '../../lib/api';
import { errorMessage } from '../../lib/error-message';
import { resetPassword } from './auth-api';
import { currentUserKey } from './use-current-user';

// Mesma regra do backend (MIN_PASSWORD_LENGTH); conferir aqui só evita uma ida à API à toa.
const MIN_PASSWORD_LENGTH = 10;

function RequestNewLink() {
  return (
    <p className="text-center text-sm">
      <Link to="/esqueci-senha" className={linkClass}>
        Pedir um novo link
      </Link>
    </p>
  );
}

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const resetMutation = useMutation({
    mutationFn: resetPassword,
    // A troca encerra todas as sessões: se havia alguém logada neste navegador, não há mais.
    onSuccess: () => queryClient.setQueryData(currentUserKey, null),
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password.length < MIN_PASSWORD_LENGTH) {
      setFormError(`A senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres`);
      return;
    }
    if (password !== confirmation) {
      setFormError('As senhas não conferem.');
      return;
    }
    setFormError(null);
    resetMutation.mutate({ token: token!, password });
  }

  if (!token) {
    return (
      <AuthCard subtitle="Redefinir senha">
        <ErrorAlert>Este link está incompleto. Abra o link do e-mail novamente ou peça um novo.</ErrorAlert>
        <RequestNewLink />
      </AuthCard>
    );
  }

  if (resetMutation.isSuccess) {
    return (
      <AuthCard subtitle="Redefinir senha">
        <p className="text-sm text-stone-700">Senha alterada! Agora é só entrar com a senha nova.</p>
        <Link to="/login" className={`block text-center ${primaryButtonClass}`}>
          Ir para o login
        </Link>
      </AuthCard>
    );
  }

  const linkIsInvalid =
    resetMutation.error instanceof ApiError && resetMutation.error.code === 'INVALID_RESET_TOKEN';
  const shownError = formError ?? (resetMutation.isError ? errorMessage(resetMutation.error) : null);

  return (
    <AuthCard subtitle="Redefinir senha">
      <form onSubmit={handleSubmit} className="space-y-5">
        <p className="text-sm text-stone-600">
          Crie uma senha nova com pelo menos {MIN_PASSWORD_LENGTH} caracteres.
        </p>

        {shownError && <ErrorAlert>{shownError}</ErrorAlert>}
        {linkIsInvalid && <RequestNewLink />}

        <div className="space-y-1">
          <label htmlFor="password" className={labelClass}>
            Senha nova
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={inputClass}
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="confirmation" className={labelClass}>
            Repita a senha nova
          </label>
          <input
            id="confirmation"
            type="password"
            autoComplete="new-password"
            required
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            className={inputClass}
          />
        </div>

        <button type="submit" disabled={resetMutation.isPending} className={primaryButtonClass}>
          {resetMutation.isPending ? 'Salvando…' : 'Salvar senha nova'}
        </button>
      </form>
    </AuthCard>
  );
}
