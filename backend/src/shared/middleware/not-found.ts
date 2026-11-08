import type { RequestHandler } from 'express';
import { NotFoundError } from '../errors.js';

export const notFound: RequestHandler = (req, _res, next) => {
  next(new NotFoundError(`Rota não encontrada: ${req.method} ${req.originalUrl}`));
};