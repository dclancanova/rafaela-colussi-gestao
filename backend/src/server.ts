import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './shared/logger.js';

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(`API rodando em http://localhost:${env.PORT} (${env.NODE_ENV})`);
});

function shutdown(signal: string) {
  logger.info(`${signal} recebido, encerrando...`);
  server.close(() => process.exit(0));
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));