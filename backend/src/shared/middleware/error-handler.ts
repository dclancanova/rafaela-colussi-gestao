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

  // 4. Qualquer outra coisa é um bug nosso: loga tudo, devolve o mínimo
  logger.error({ err, method: req.method, url: req.originalUrl }, 'Erro não tratado');
  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' },
  });
};