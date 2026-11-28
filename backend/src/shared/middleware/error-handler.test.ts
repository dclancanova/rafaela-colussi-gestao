import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';

const app = createApp();

describe('errorHandler', () => {
  it('responde 400 para JSON malformado', async () => {
    const res = await request(app)
      .post('/api/qualquer')
      .set('Content-Type', 'application/json')
      .send('{"email": ');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_JSON');
  });

  it('responde 413 (e não 500) para corpo maior que o limite', async () => {
    const res = await request(app)
      .post('/api/qualquer')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ texto: 'a'.repeat(1024 * 1024 + 1) }));

    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });
});
