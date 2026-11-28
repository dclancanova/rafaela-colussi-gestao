/** Código do Postgres para "valor repetido em coluna/índice único". */
const UNIQUE_VIOLATION = '23505';

type PgErrorFields = { code?: unknown; constraint?: unknown };

/**
 * Diz se o erro é de valor único repetido (de uma restrição específica, se informada).
 * O Drizzle embrulha o erro do Postgres: o original fica em `cause`.
 */
export function isUniqueViolation(err: unknown, constraint?: string): boolean {
  const candidates = [err, (err as { cause?: unknown } | null)?.cause];

  return candidates.some((candidate) => {
    if (typeof candidate !== 'object' || candidate === null) return false;
    const { code, constraint: name } = candidate as PgErrorFields;
    return code === UNIQUE_VIOLATION && (constraint === undefined || name === constraint);
  });
}
