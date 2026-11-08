import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';

const app = createApp();

describe('GET /api/health', () => {
  it('retorna status ok', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('retorna erro estruturado para rota inexistente', async () => {
    const res = await request(app).get('/api/nao-existe');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});