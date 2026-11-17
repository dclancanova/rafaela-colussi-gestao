/**
 * URL do banco usado pelos testes de integração.
 * Usa TEST_DATABASE_URL se existir; senão, o mesmo servidor do DATABASE_URL
 * com o nome do banco terminado em "_test".
 */
export function resolveTestDatabaseUrl(environment: NodeJS.ProcessEnv): string | undefined {
  if (environment.TEST_DATABASE_URL) return environment.TEST_DATABASE_URL;
  if (!environment.DATABASE_URL) return undefined;

  const url = new URL(environment.DATABASE_URL);
  url.pathname = `${url.pathname}_test`;
  return url.toString();
}

/** Os testes apagam dados: nunca rodar contra um banco que não seja de teste. */
export function assertIsTestDatabase(databaseUrl: string): string {
  const name = new URL(databaseUrl).pathname.slice(1);
  if (!name.endsWith('_test')) {
    throw new Error(`Banco de teste deve terminar em "_test" (recebido: "${name}")`);
  }
  return name;
}
