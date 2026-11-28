import { ApiError } from './api';

/** Texto para mostrar na tela a partir de um erro da API. */
export function errorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return 'Algo deu errado. Tente novamente.';

  // Dados inválidos: a mensagem do primeiro campo é mais útil que o genérico "Dados inválidos".
  if (error.code === 'VALIDATION_ERROR' && Array.isArray(error.details)) {
    const first: unknown = (error.details[0] as { message?: unknown } | undefined)?.message;
    if (typeof first === 'string') return first;
  }

  // 401, 429, link inválido e falha de conexão já vêm com mensagem amigável.
  return error.message;
}
