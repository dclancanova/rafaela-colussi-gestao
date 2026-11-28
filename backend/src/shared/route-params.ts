import { z } from 'zod';
import { NotFoundError } from './errors.js';

const idSchema = z.coerce.number().int().positive();

/** Id da URL. "/abc" é um endereço que não existe: 404, como qualquer id desconhecido. */
export function parseIdParam(value: string | undefined, notFoundMessage: string): number {
  const parsed = idSchema.safeParse(value);
  if (!parsed.success) throw new NotFoundError(notFoundMessage);
  return parsed.data;
}
