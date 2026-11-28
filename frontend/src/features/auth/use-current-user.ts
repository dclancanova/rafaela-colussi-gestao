import { useQuery } from '@tanstack/react-query';
import { fetchCurrentUser } from './auth-api';

/** Chave do cache da sessão: login e logout atualizam este mesmo lugar. */
export const currentUserKey = ['auth', 'current-user'] as const;

export function useCurrentUser() {
  return useQuery({
    queryKey: currentUserKey,
    queryFn: fetchCurrentUser,
    // A sessão só muda por login/logout (que atualizam o cache) ou por um 401 (tratado no query-client).
    staleTime: Infinity,
  });
}
