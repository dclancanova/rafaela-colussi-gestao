import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    env: {
      // Valor fictício: os testes unitários não abrem conexão com o banco.
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    },
  },
});