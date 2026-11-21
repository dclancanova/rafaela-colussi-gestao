import { logger } from '../../shared/logger.js';
import { deleteExpiredSessions } from './auth.service.js';

const SIX_HOURS = 6 * 60 * 60 * 1000;

async function runCleanup(): Promise<void> {
  // Falha na limpeza não pode derrubar a API: registra e tenta na próxima rodada.
  try {
    const deleted = await deleteExpiredSessions();
    if (deleted > 0) {
      logger.info({ deleted }, 'Sessões expiradas removidas');
    }
  } catch (err) {
    logger.error({ err }, 'Falha ao remover sessões expiradas');
  }
}

/** Limpa agora e depois a cada intervalo. Devolve a função que para a limpeza. */
export function startSessionCleanup(intervalMs: number = SIX_HOURS): () => void {
  void runCleanup();

  const timer = setInterval(() => void runCleanup(), intervalMs);
  timer.unref();

  return () => clearInterval(timer);
}
