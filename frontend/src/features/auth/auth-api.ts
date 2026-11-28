import { ApiError, api } from '../../lib/api';

/** Mesmo formato que o backend devolve em /auth/login e /auth/me. */
export type User = {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'member';
};

export type Credentials = {
  email: string;
  password: string;
};

export function login(credentials: Credentials) {
  return api<{ user: User }>('/auth/login', { method: 'POST', body: credentials });
}

export function logout() {
  return api<void>('/auth/logout', { method: 'POST' });
}

/** Pede o link de redefinição. A API responde igual exista a conta ou não. */
export function requestPasswordReset(email: string) {
  return api<void>('/auth/forgot-password', { method: 'POST', body: { email } });
}

export function resetPassword(input: { token: string; password: string }) {
  return api<void>('/auth/reset-password', { method: 'POST', body: input });
}

/** A usuária da sessão atual, ou null se ninguém estiver logado. */
export async function fetchCurrentUser(): Promise<User | null> {
  try {
    const { user } = await api<{ user: User }>('/auth/me');
    return user;
  } catch (error) {
    // 401 aqui não é falha: só significa "sem sessão".
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}
