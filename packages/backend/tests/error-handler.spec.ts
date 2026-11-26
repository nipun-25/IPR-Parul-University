import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { BackendEnv } from '../src/config/env.config.js';

describe('RFC 7807 Centralized Error Handling (Gate A1)', () => {
  const testEnv: BackendEnv = {
    NODE_ENV: 'test',
    PORT: 4001,
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

  it('formats SQLSTATE mapped errors as application/problem+json', async () => {
    const res = await request(app)
      .get('/api/v1/test-error?type=sqlstate_ipr01&sensitive_query_param=secret123')
      .expect(400);

    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.body).toMatchObject({
      type: 'https://ipr.paruluniversity.ac.in/errors/AUTH_INVALID_PARAMETERS',
      title: 'Invalid Authorization',
      status: 400,
      code: 'AUTH_INVALID_PARAMETERS',
      instance: '/api/v1/test-error' // Proves query parameters are stripped
    });
    // Ensure sensitive query parameters were not leaked in problem details instance
    expect(res.body.instance).not.toContain('sensitive_query_param');
  });

  it('formats custom AppError correctly', async () => {
    const res = await request(app)
      .get('/api/v1/test-error?type=app_error')
      .expect(422);

    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.body).toMatchObject({
      type: 'https://ipr.paruluniversity.ac.in/errors/VALIDATION_FAILED',
      title: 'Validation Failed',
      status: 422,
      code: 'VALIDATION_FAILED',
      detail: 'The submitted entity failed business validation.',
      instance: '/api/v1/test-error'
    });
  });

  it('formats 404 Route Not Found as RFC 7807 problem details', async () => {
    const res = await request(app)
      .get('/unknown-endpoint?query=value')
      .expect(404);

    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.body).toMatchObject({
      type: 'https://ipr.paruluniversity.ac.in/errors/ROUTE_NOT_FOUND',
      title: 'Not Found',
      status: 404,
      code: 'ROUTE_NOT_FOUND',
      instance: '/unknown-endpoint'
    });
  });
});
