import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import type { Pool } from 'pg';
import { InMemoryNonceStore, generateCsrfToken } from '@ipr/shared';
import { createApp } from '../src/app.js';
import { BackendEnv } from '../src/config/env.config.js';
import { EmailService } from '../src/services/email.service.js';
import { PRE_AUTH_CSRF_COOKIE_NAME } from '../src/utils/cookie.util.js';

describe('Stage 2F.2C — Pre-Authentication CSRF Protection', () => {
  const testSecret = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  const testEnv: BackendEnv = {
    NODE_ENV: 'test',
    PORT: 4005,
    CORS_ORIGIN: 'http://localhost:3000',
    LOG_LEVEL: 'silent',
    BFF_SHARED_SECRET: testSecret,
    DB_HOST: 'localhost',
    DB_PORT: 5432,
    DB_NAME: 'ipr_test',
    DB_USER: 'ipr_app',
    DB_PASSWORD: 'secret',
    DB_SSL: false,
    SMTP_HOST: 'smtp.gmail.com',
    SMTP_PORT: 587,
    SMTP_USER: 'ipr-portal@paruluniversity.ac.in',
    SMTP_PASSWORD: 'smtp-secret-pass'
  };

  const validRegistrationPayload = {
    email: 'csrf.student@paruluniversity.ac.in',
    fullName: 'CSRF Student',
    password: 'ValidPassword123!'
  };

  let mockPool: { query: ReturnType<typeof vi.fn> };
  let mockEmailService: { sendEmail: ReturnType<typeof vi.fn>; verifyConnection: ReturnType<typeof vi.fn> };
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    mockPool = {
      query: vi.fn().mockResolvedValue({
        rows: [{ registration_id: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a99', user_id: 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' }]
      })
    };
    mockEmailService = {
      sendEmail: vi.fn().mockResolvedValue(undefined),
      verifyConnection: vi.fn().mockResolvedValue(undefined)
    };
    app = createApp(testEnv, {
      dbPool: mockPool as unknown as Pool,
      emailService: mockEmailService as unknown as EmailService,
      nonceStore: new InMemoryNonceStore(),
      csrfSecret: testSecret
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function getCsrfCredentials() {
    const res = await request(app)
      .get('/api/v1/auth/csrf')
      .set('Origin', 'http://localhost:3000')
      .expect(200);

    const csrfToken = res.body.csrfToken;
    const cookie = res.headers['set-cookie']?.[0];
    return { csrfToken, cookie };
  }

  describe('1. CSRF Bootstrap Endpoint (GET /api/v1/auth/csrf)', () => {
    it('sets a short-lived HttpOnly cookie and returns a synchronizer token', async () => {
      const res = await request(app)
        .get('/api/v1/auth/csrf')
        .set('Origin', 'http://localhost:3000')
        .expect(200);

      expect(typeof res.body.csrfToken).toBe('string');
      expect(res.body.csrfToken).toContain('.');

      const setCookie = res.headers['set-cookie']?.[0];
      expect(setCookie).toBeDefined();
      expect(setCookie).toContain(PRE_AUTH_CSRF_COOKIE_NAME);
      expect(setCookie).toContain('HttpOnly');
      expect(setCookie).toContain('SameSite=Lax');
      expect(setCookie).toContain('Path=/api/v1/auth');
    });

    it('enforces rate limiting on bootstrap endpoint', async () => {
      const rateLimitedApp = createApp(testEnv, {
        dbPool: mockPool as unknown as Pool,
        emailService: mockEmailService as unknown as EmailService,
        nonceStore: new InMemoryNonceStore(),
        csrfRateLimitMax: 2
      });

      // Request 1
      await request(rateLimitedApp).get('/api/v1/auth/csrf').set('Origin', 'http://localhost:3000').expect(200);
      // Request 2
      await request(rateLimitedApp).get('/api/v1/auth/csrf').set('Origin', 'http://localhost:3000').expect(200);
      // Request 3: blocked
      const res = await request(rateLimitedApp)
        .get('/api/v1/auth/csrf')
        .set('Origin', 'http://localhost:3000')
        .expect(429);

      expect(res.body.code).toBe('CSRF_RATE_LIMIT_EXCEEDED');
    });
  });

  describe('2. State-Changing Route Protection with CSRF (POST /register & /verify-email)', () => {
    it('succeeds when valid CSRF token, matching cookie, valid Origin, and JSON content type are provided', async () => {
      const { csrfToken, cookie } = await getCsrfCredentials();

      const res = await request(app)
        .post('/api/v1/auth/register')
        .set('Origin', 'http://localhost:3000')
        .set('Content-Type', 'application/json')
        .set('X-CSRF-Token', csrfToken)
        .set('Cookie', cookie)
        .send(validRegistrationPayload)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(mockPool.query).toHaveBeenCalledTimes(1);
    });

    it('succeeds for email verification with valid CSRF credentials', async () => {
      const { csrfToken, cookie } = await getCsrfCredentials();

      const res = await request(app)
        .post('/api/v1/auth/verify-email')
        .set('Origin', 'http://localhost:3000')
        .set('Content-Type', 'application/json')
        .set('X-CSRF-Token', csrfToken)
        .set('Cookie', cookie)
        .send({ token: 'a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(mockPool.query).toHaveBeenCalledTimes(1);
    });

    it('rejects state-changing request when X-CSRF-Token header is missing with 403', async () => {
      const { cookie } = await getCsrfCredentials();

      const res = await request(app)
        .post('/api/v1/auth/register')
        .set('Origin', 'http://localhost:3000')
        .set('Content-Type', 'application/json')
        .set('Cookie', cookie)
        .send(validRegistrationPayload)
        .expect(403);

      expect(res.body.code).toBe('CSRF_TOKEN_MISSING');
      expect(mockPool.query).not.toHaveBeenCalled();
    });

    it('rejects state-changing request when pre-auth CSRF cookie is missing with 403', async () => {
      const { csrfToken } = await getCsrfCredentials();

      const res = await request(app)
        .post('/api/v1/auth/register')
        .set('Origin', 'http://localhost:3000')
        .set('Content-Type', 'application/json')
        .set('X-CSRF-Token', csrfToken)
        .send(validRegistrationPayload)
        .expect(403);

      expect(res.body.code).toBe('CSRF_COOKIE_MISSING');
      expect(mockPool.query).not.toHaveBeenCalled();
    });

    it('rejects invalid or tampered CSRF token with 403', async () => {
      const { cookie } = await getCsrfCredentials();

      const res = await request(app)
        .post('/api/v1/auth/register')
        .set('Origin', 'http://localhost:3000')
        .set('Content-Type', 'application/json')
        .set('X-CSRF-Token', '00000000000000000000000000000000.1111111111111111111111111111111111111111111111111111111111111111')
        .set('Cookie', cookie)
        .send(validRegistrationPayload)
        .expect(403);

      expect(res.body.code).toBe('CSRF_TOKEN_INVALID');
      expect(mockPool.query).not.toHaveBeenCalled();
    });

    it('rejects cookie and token mismatch with 403', async () => {
      // Session A credentials
      const credsA = await getCsrfCredentials();
      // Session B credentials
      const credsB = await getCsrfCredentials();

      // Submit token from session A with cookie from session B
      const res = await request(app)
        .post('/api/v1/auth/register')
        .set('Origin', 'http://localhost:3000')
        .set('Content-Type', 'application/json')
        .set('X-CSRF-Token', credsA.csrfToken)
        .set('Cookie', credsB.cookie)
        .send(validRegistrationPayload)
        .expect(403);

      expect(res.body.code).toBe('CSRF_TOKEN_INVALID');
      expect(mockPool.query).not.toHaveBeenCalled();
    });

    it('rejects missing or disallowed Origin with 403', async () => {
      const { csrfToken, cookie } = await getCsrfCredentials();

      // Missing Origin
      const missingOriginRes = await request(app)
        .post('/api/v1/auth/register')
        .set('Content-Type', 'application/json')
        .set('X-CSRF-Token', csrfToken)
        .set('Cookie', cookie)
        .send(validRegistrationPayload)
        .expect(403);

      expect(missingOriginRes.body.code).toBe('ORIGIN_FORBIDDEN');

      // Disallowed Origin
      const disallowedOriginRes = await request(app)
        .post('/api/v1/auth/register')
        .set('Origin', 'http://attacker-site.com')
        .set('Content-Type', 'application/json')
        .set('X-CSRF-Token', csrfToken)
        .set('Cookie', cookie)
        .send(validRegistrationPayload)
        .expect(403);

      expect(disallowedOriginRes.body.code).toBe('ORIGIN_FORBIDDEN');
      expect(mockPool.query).not.toHaveBeenCalled();
    });

    it('rejects non-JSON Content-Type on state-changing requests with 415', async () => {
      const { csrfToken, cookie } = await getCsrfCredentials();

      const res = await request(app)
        .post('/api/v1/auth/register')
        .set('Origin', 'http://localhost:3000')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .set('X-CSRF-Token', csrfToken)
        .set('Cookie', cookie)
        .send('email=csrf.student@paruluniversity.ac.in')
        .expect(415);

      expect(res.body.code).toBe('UNSUPPORTED_MEDIA_TYPE');
      expect(mockPool.query).not.toHaveBeenCalled();
    });

    it('rejects expired pre-auth CSRF tokens with 403', async () => {
      // Craft expired cookie (issued 20 minutes ago)
      const expiredTimestamp = Date.now() - 20 * 60 * 1000;
      const nonce = 'a'.repeat(32);
      const expiredCookieVal = `${nonce}:${expiredTimestamp}`;

      const validHmacToken = generateCsrfToken(expiredCookieVal, testSecret);

      const res = await request(app)
        .post('/api/v1/auth/register')
        .set('Origin', 'http://localhost:3000')
        .set('Content-Type', 'application/json')
        .set('X-CSRF-Token', validHmacToken)
        .set('Cookie', `${PRE_AUTH_CSRF_COOKIE_NAME}=${expiredCookieVal}`)
        .send(validRegistrationPayload)
        .expect(403);

      expect(res.body.code).toBe('CSRF_TOKEN_EXPIRED');
      expect(mockPool.query).not.toHaveBeenCalled();
    });
  });
});
