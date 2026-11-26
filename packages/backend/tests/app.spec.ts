import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import type { Pool } from 'pg';
import { createApp } from '../src/app.js';
import { BackendEnv } from '../src/config/env.config.js';

describe('Express Application Shell (Gate A1)', () => {
  const testEnv: BackendEnv = {
    NODE_ENV: 'test',
    PORT: 4002,
    CORS_ORIGIN: 'http://localhost:3000',
    LOG_LEVEL: 'silent',
    BFF_SHARED_SECRET: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    DB_HOST: 'localhost',
    DB_PORT: 5432,
    DB_NAME: 'ipr_test',
    DB_USER: 'ipr_app',
    DB_PASSWORD: 'secret',
    DB_SSL: false,
    SMTP_HOST: 'smtp.gmail.com',
    SMTP_PORT: 587,
    SMTP_USER: 'test@example.com',
    SMTP_PASSWORD: 'test-password'
  };

  const app = createApp(testEnv);

  it('responds with 200 OK on GET /health', async () => {
    const res = await request(app).get('/health').expect(200);
    expect(res.body.status).toBe('healthy');
    expect(res.body.environment).toBe('test');
    expect(res.body.timestamp).toBeDefined();
  });

  it('injects and echoes x-request-id header on every response', async () => {
    const res = await request(app).get('/health').expect(200);
    expect(res.headers['x-request-id']).toBeDefined();
    expect(typeof res.headers['x-request-id']).toBe('string');
  });

  it('preserves client-provided x-request-id header', async () => {
    const clientReqId = 'custom-client-req-id-12345';
    const res = await request(app)
      .get('/health')
      .set('x-request-id', clientReqId)
      .expect(200);
    expect(res.headers['x-request-id']).toBe(clientReqId);
  });

  it('includes standard security headers via helmet', async () => {
    const res = await request(app).get('/health').expect(200);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
  });

  it('reports database as not_configured when no pool is passed', async () => {
    const res = await request(app).get('/health').expect(200);
    expect(res.body.database).toBe('not_configured');
  });

  it('reports database as connected and status healthy when dbPool query succeeds', async () => {
    const mockPool = {
      query: vi.fn().mockResolvedValue({ rows: [{ '?column?': 1 }] })
    } as unknown as Pool;
    const appWithDb = createApp(testEnv, { dbPool: mockPool });

    const res = await request(appWithDb).get('/health').expect(200);
    expect(res.body.status).toBe('healthy');
    expect(res.body.database).toBe('connected');
    expect(mockPool.query).toHaveBeenCalledWith('SELECT 1');
  });

  it('reports database as disconnected and status unhealthy with 503 when dbPool query fails', async () => {
    const mockPool = {
      query: vi.fn().mockRejectedValue(new Error('Connection lost'))
    } as unknown as Pool;
    const appWithFailingDb = createApp(testEnv, { dbPool: mockPool });

    const res = await request(appWithFailingDb).get('/health').expect(503);
    expect(res.body.status).toBe('unhealthy');
    expect(res.body.database).toBe('disconnected');
    expect(res.body.error).toBeUndefined(); // internal error details must not be exposed
    expect(mockPool.query).toHaveBeenCalledWith('SELECT 1');
  });
});
