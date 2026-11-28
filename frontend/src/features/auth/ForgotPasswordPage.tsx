import { useMutation } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { AuthCard, ErrorAlert } from '../../components/AuthCard';
import { inputClass, labelClass, linkClass, primaryButtonClass } from '../../components/form-styles';
import { errorMessage } from '../../lib/error-message';
import { requestPasswordReset } from './auth-api';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const requestMutation = useMutation({ mutationFn: requestPasswordReset });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    requestMutation.mutate(email);
  }

  if (requestMutation.isSuccess) {
    return (
      <AuthCard subtitle="Esqueci minha senha">
        {/* Mesma mensagem exista a conta ou não: a tela não revela quem tem cadastro. */}
        <div className="space-y-3 text-sm text-stone-700">
          <p>
            Se houver uma conta com <strong>{email.trim()}</strong>, enviamos um link para criar uma senha
            nova.
          </p>
          <p>O link vale por 1 hora. Confira também a caixa de spam.</p>
        </div>
        <p className="text-center text-sm">
          <Link to="/login" className={linkClass}>
            Voltar para o login
          </Link>
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard subtitle="Esqueci minha senha">
      <form onSubmit={handleSubmit} className="space-y-5">
        <p className="text-sm text-stone-600">
          Informe o seu e-mail e enviaremos um link para você criar uma senha nova.
        </p>

        {requestMutation.isError && <ErrorAlert>{errorMessage(requestMutation.error)}</ErrorAlert>}

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

        <button type="submit" disabled={requestMutation.isPending} className={primaryButtonClass}>
          {requestMutation.isPending ? 'Enviando…' : 'Enviar link'}
        </button>

        <p className="text-center text-sm">
          <Link to="/login" className={linkClass}>
            Voltar para o login
          </Link>
        </p>
      </form>
    </AuthCard>
  );
}
