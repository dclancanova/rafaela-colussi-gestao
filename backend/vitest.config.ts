import { defineConfig } from 'vitest/config';
import { resolveTestDatabaseUrl } from './src/test/test-database-url.js';

// Carrega o .env (se existir) para descobrir o servidor do banco de teste.
try {
  process.loadEnvFile('.env');
} catch {
  // Sem .env: os testes de integração vão falhar com mensagem clara no global setup.
}

export default defineConfig({
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['src/**/*.test.ts'],
          exclude: ['src/**/*.int.test.ts'],
          env: {
            // Valor fictício: os testes unitários não abrem conexão com o banco.
            DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
          },
        },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          include: ['src/**/*.int.test.ts'],
          globalSetup: ['./src/test/global-setup.ts'],
          // Todos os arquivos compartilham o mesmo banco: um de cada vez.
          fileParallelism: false,
          env: {
            NODE_ENV: 'test',
            DATABASE_URL: resolveTestDatabaseUrl(process.env) ?? '',
          },
        },
      },
    ],
  },
});
