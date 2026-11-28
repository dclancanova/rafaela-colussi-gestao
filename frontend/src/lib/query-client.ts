import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { currentUserKey } from '../features/auth/use-current-user';
import { ApiError } from './api';

function handleError(error: unknown) {
  // Sessão expirou ou foi encerrada (ex.: senha trocada em outro lugar): marca como deslogada,
  // e as rotas protegidas mandam para o login.
  if (error instanceof ApiError && error.status === 401) {
    queryClient.setQueryData(currentUserKey, null);
  }
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: handleError }),
  mutationCache: new MutationCache({ onError: handleError }),
  defaultOptions: {
    queries: {
      // Erros esperados da API (401, 403, 404, 422…) não melhoram tentando de novo.
      retry: (failureCount, error) => !(error instanceof ApiError && error.status < 500) && failureCount < 2,
    },
  },
});
