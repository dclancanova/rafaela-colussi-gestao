import request from 'supertest';
import type { createApp } from '../app.js';
import { createTestUser } from './db.js';

/**
 * Cria uma usuária e faz login de verdade pela API.
 * O "agent" do supertest guarda o cookie da sessão e o envia nas próximas chamadas, como um navegador.
 */
export async function loginAsTestUser(
  app: ReturnType<typeof createApp>,
  overrides: Parameters<typeof createTestUser>[0] = {},
) {
  const user = await createTestUser(overrides);
  const agent = request.agent(app);

  const res = await agent.post('/api/auth/login').send({ email: user.email, password: user.password });
  if (res.status !== 200) {
    throw new Error(`Login de teste falhou (${res.status}): ${JSON.stringify(res.body)}`);
  }

  return { agent, user };
}
