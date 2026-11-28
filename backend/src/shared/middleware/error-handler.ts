import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../errors.js';
import { logger } from '../logger.js';

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  // 1. Dados inválidos vindos do Zod
  if (err instanceof ZodError) {
    res.status(422).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Dados inválidos',
        details: err.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      },
    });
    return;
  }

  // 2. JSON malformado no corpo da requisição
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({
      error: { code: 'INVALID_JSON', message: 'O corpo da requisição não é um JSON válido' },
    });
    return;
  }

  // 3. Erros esperados da nossa aplicação
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
    return;
  }

  // 4. Erros do Express que já apontam um problema na requisição (ex.: corpo grande demais = 413)
  const clientStatus = clientErrorStatus(err);
  if (clientStatus) {
    res.status(clientStatus).json({
      error:
        clientStatus === 413
          ? { code: 'PAYLOAD_TOO_LARGE', message: 'O corpo da requisição é grande demais' }
          : { code: 'BAD_REQUEST', message: 'Requisição inválida' },
    });
    return;
  }

  // 5. Qualquer outra coisa é um bug nosso: loga tudo, devolve o mínimo
  logger.error({ err, method: req.method, url: req.originalUrl }, 'Erro não tratado');
  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' },
  });
};

/** O status 4xx que o erro traz (padrão das bibliotecas do Express), ou null se não trouxer. */
function clientErrorStatus(err: unknown): number | null {
  if (typeof err !== 'object' || err === null || !('status' in err)) return null;
  const { status } = err;
  return typeof status === 'number' && status >= 400 && status < 500 ? status : null;
}
