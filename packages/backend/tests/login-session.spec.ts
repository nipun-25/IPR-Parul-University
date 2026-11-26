import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import type { Pool } from 'pg';
import argon2 from 'argon2';
import { InMemoryNonceStore, computeSha256 } from '@ipr/shared';
import { createApp } from '../src/app.js';
import { BackendEnv } from '../src/config/env.config.js';
import { EmailService } from '../src/services/email.service.js';
import { logger } from '../src/config/logger.config.js';

function getCookies(header: string | string[] | undefined): string[] {
  if (!header) return [];
  return Array.isArray(header) ? header : [header];
}

describe('Stage 2F.3 — Student Login & Session Lifecycle', () => {
  let mockPool: { query: ReturnType<typeof vi.fn> };
  let mockEmailService: { sendEmail: ReturnType<typeof vi.fn>; verifyConnection: ReturnType<typeof vi.fn> };
  let app: ReturnType<typeof createApp>;

  const testEnv: BackendEnv = {
    NODE_ENV: 'test',
    PORT: 4005,
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
    SMTP_USER: 'ipr-portal@paruluniversity.ac.in',
    SMTP_PASSWORD: 'smtp-secret-pass'
  };

  const validEmail = 'student.login@paruluniversity.ac.in';
  const rawPassword = 'SecurePassword123!';
  let passwordHash: string;

  let defaultCsrfToken = '';
  let defaultCsrfCookie = '';

  beforeEach(async () => {
    passwordHash = await argon2.hash(rawPassword, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4
    });

    mockPool = { query: vi.fn() };
    mockEmailService = {
      sendEmail: vi.fn().mockResolvedValue(undefined),
      verifyConnection: vi.fn().mockResolvedValue(undefined)
    };

    app = createApp(testEnv, {
      dbPool: mockPool as unknown as Pool,
      emailService: mockEmailService as unknown as EmailService,
      nonceStore: new InMemoryNonceStore()
    });

    const csrfRes = await request(app)
      .get('/api/v1/auth/csrf')
      .set('Origin', 'http://localhost:3000');
    defaultCsrfToken = csrfRes.body.csrfToken;
    defaultCsrfCookie = csrfRes.headers['set-cookie']?.[0] || '';
  });

  describe('1. Student Login (POST /api/v1/auth/login)', () => {
    it('successfully logs in with valid credentials and sets secure HttpOnly session cookie', async () => {
      // 1. get_login_credentials_v1 returns active user
      mockPool.query
        .mockResolvedValueOnce({
          rows: [
            {
              user_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
              email: validEmail,
              full_name: 'Jane Student',
              roles: ['Student'],
              account_status: 'ACTIVE',
              password_hash: passwordHash,
              failed_login_attempts: 0,
              locked_until: null
            }
          ]
        })
        // 2. record_login_attempt_v1(user_id, true) resets attempts
        .mockResolvedValueOnce({ rows: [{ failed_attempts: 0, account_locked_until: null }] })
        // 3. create_user_session_v1 returns session_id
        .mockResolvedValueOnce({ rows: [{ session_id: 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380acc' }] });

      const res = await request(app)
        .post('/api/v1/auth/login')
        .set('Origin', 'http://localhost:3000')
        .set('X-CSRF-Token', defaultCsrfToken)
        .set('Cookie', defaultCsrfCookie)
        .send({ email: validEmail, password: rawPassword })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.user.id).toBe('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');
      expect(res.body.user.email).toBe(validEmail);
      expect(res.body.user.fullName).toBe('Jane Student');
      expect(res.body.user.activeRoles).toEqual(['Student']);
      expect(res.body.csrfToken).toBeDefined();

      // Session token must NOT appear in response body
      expect(res.body).not.toHaveProperty('sessionToken');
      expect(res.body).not.toHaveProperty('rawSessionToken');

      // Verify Set-Cookie header
      const cookies = getCookies(res.headers['set-cookie']);
      expect(cookies.length).toBeGreaterThan(0);
      const sessionCookie = cookies.find((c: string) => c.startsWith('ipr_session='));
      expect(sessionCookie).toBeDefined();
      expect(sessionCookie).toContain('HttpOnly');
      expect(sessionCookie).toContain('SameSite=Lax');
      expect(sessionCookie).toContain('Path=/');

      // Verify database calls
      const [sqlSession, paramsSession] = mockPool.query.mock.calls[2];
      expect(sqlSession).toContain('auth_internal.create_user_session_v1');
      expect(paramsSession[0]).toBe('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');
      // Token hash must be a 64-char lowercase hex SHA-256 hash
      expect(paramsSession[1]).toMatch(/^[a-f0-9]{64}$/);
      expect(paramsSession[2]).toBeInstanceOf(Date);
    });

    it('rejects invalid password and records failed attempt in database', async () => {
      mockPool.query
        .mockResolvedValueOnce({
          rows: [
            {
              user_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
              email: validEmail,
              full_name: 'Jane Student',
              roles: ['Student'],
              account_status: 'ACTIVE',
              password_hash: passwordHash,
              failed_login_attempts: 1,
              locked_until: null
            }
          ]
        })
        .mockResolvedValueOnce({ rows: [{ failed_attempts: 2, account_locked_until: null }] });

      const res = await request(app)
        .post('/api/v1/auth/login')
        .set('Origin', 'http://localhost:3000')
        .set('X-CSRF-Token', defaultCsrfToken)
        .set('Cookie', defaultCsrfCookie)
        .send({ email: validEmail, password: 'WrongPassword999!' })
        .expect(401);

      expect(res.body.code).toBe('INVALID_CREDENTIALS');
      expect(res.body.detail).toContain('Invalid institutional email or password');

      // Proves record_login_attempt_v1 was called with false
      const [sqlAttempt, paramsAttempt] = mockPool.query.mock.calls[1];
      expect(sqlAttempt).toContain('auth_internal.record_login_attempt_v1');
      expect(paramsAttempt[0]).toBe('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');
      expect(paramsAttempt[1]).toBe(false);

      // No session cookie should be set
      const cookies = getCookies(res.headers['set-cookie']);
      expect(cookies.some((c: string) => c.startsWith('ipr_session='))).toBeFalsy();
    });

    it('returns generic invalid credentials for unknown email without disclosing account absence', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .post('/api/v1/auth/login')
        .set('Origin', 'http://localhost:3000')
        .set('X-CSRF-Token', defaultCsrfToken)
        .set('Cookie', defaultCsrfCookie)
        .send({ email: 'nonexistent@paruluniversity.ac.in', password: 'AnyPassword123!' })
        .expect(401);

      expect(res.body.code).toBe('INVALID_CREDENTIALS');
      expect(res.body.detail).toContain('Invalid institutional email or password');
    });

    it('returns generic invalid credentials for unverified pending registration', async () => {
      // An unverified registration exists in pending_registrations but not in portal_users
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .post('/api/v1/auth/login')
        .set('Origin', 'http://localhost:3000')
        .set('X-CSRF-Token', defaultCsrfToken)
        .set('Cookie', defaultCsrfCookie)
        .send({ email: 'unverified@paruluniversity.ac.in', password: rawPassword })
        .expect(401);

      expect(res.body.code).toBe('INVALID_CREDENTIALS');
      expect(res.body.detail).toContain('Invalid institutional email or password');
    });

    it('enforces account lockout when locked_until is active and returns generic invalid credentials', async () => {
      const futureLockout = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // locked for 10 more minutes
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            user_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
            email: validEmail,
            full_name: 'Jane Student',
            roles: ['Student'],
            account_status: 'ACTIVE',
            password_hash: passwordHash,
            failed_login_attempts: 5,
            locked_until: futureLockout
          }
        ]
      });

      // Even with the correct password, login must be denied while locked
      const res = await request(app)
        .post('/api/v1/auth/login')
        .set('Origin', 'http://localhost:3000')
        .set('X-CSRF-Token', defaultCsrfToken)
        .set('Cookie', defaultCsrfCookie)
        .send({ email: validEmail, password: rawPassword })
        .expect(401);

      expect(res.body.code).toBe('INVALID_CREDENTIALS');
      expect(res.body.detail).toContain('Invalid institutional email or password');

      // Database session creation must NOT be reached
      expect(mockPool.query).toHaveBeenCalledTimes(1);
    });
  });

  describe('2. Session Validation (GET /api/v1/auth/session)', () => {
    const rawSessionToken = '11223344556677889900aabbccddeeff11223344556677889900aabbccddeeff';

    it('successfully validates active session and updates last_seen_at', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            session_id: 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380add',
            user_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
            email: validEmail,
            full_name: 'Jane Student',
            roles: ['Student'],
            expires_at: new Date(Date.now() + 86400 * 1000).toISOString()
          }
        ]
      });

      const res = await request(app)
        .get('/api/v1/auth/session')
        .set('Cookie', `ipr_session=${rawSessionToken}`)
        .expect(200);

      expect(res.body.authenticated).toBe(true);
      expect(res.body.user.id).toBe('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');
      expect(res.body.user.activeRoles).toEqual(['Student']);
      expect(res.body.csrfToken).toBeDefined();

      const [sql, params] = mockPool.query.mock.calls[0];
      expect(sql).toContain('auth_internal.validate_user_session_v1');
      expect(params[0]).toBe(computeSha256(rawSessionToken));
    });

    it('returns 401 when session cookie is missing', async () => {
      const res = await request(app)
        .get('/api/v1/auth/session')
        .expect(401);

      expect(res.body.authenticated).toBe(false);
      expect(mockPool.query).not.toHaveBeenCalled();
    });

    it('returns 401 and clears cookie when session is expired or invalid in database', async () => {
      // Database returns 0 rows (expired or revoked)
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .get('/api/v1/auth/session')
        .set('Cookie', `ipr_session=${rawSessionToken}`)
        .expect(401);

      expect(res.body.authenticated).toBe(false);

      // Verify Set-Cookie clears the cookie
      const cookies = getCookies(res.headers['set-cookie']);
      expect(cookies.length).toBeGreaterThan(0);
      const sessionCookie = cookies.find((c: string) => c.startsWith('ipr_session='));
      expect(sessionCookie).toContain('Max-Age=0');
    });
  });

  describe('3. Logout & Session Revocation (POST /api/v1/auth/logout)', () => {
    const rawSessionToken = '11223344556677889900aabbccddeeff11223344556677889900aabbccddeeff';

    it('revokes server-side session in database and clears session cookie', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ revoke_user_session_v1: true }] });

      const res = await request(app)
        .post('/api/v1/auth/logout')
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', `ipr_session=${rawSessionToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);

      const [sql, params] = mockPool.query.mock.calls[0];
      expect(sql).toContain('auth_internal.revoke_user_session_v1');
      expect(params[0]).toBe(computeSha256(rawSessionToken));

      const cookies = getCookies(res.headers['set-cookie']);
      expect(cookies.length).toBeGreaterThan(0);
      const sessionCookie = cookies.find((c: string) => c.startsWith('ipr_session='));
      expect(sessionCookie).toContain('Max-Age=0');
    });
  });

  describe('4. Security Controls & Protections', () => {
    it('rejects login requests with missing or untrusted Origin header', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .set('Origin', 'http://evil.com')
        .set('X-CSRF-Token', defaultCsrfToken)
        .set('Cookie', defaultCsrfCookie)
        .send({ email: validEmail, password: rawPassword })
        .expect(403);

      expect(res.body.code).toBe('ORIGIN_FORBIDDEN');
      expect(mockPool.query).not.toHaveBeenCalled();
    });

    it('rejects login requests with missing CSRF token', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', defaultCsrfCookie)
        .send({ email: validEmail, password: rawPassword })
        .expect(403);

      expect(res.body.code).toBe('CSRF_TOKEN_MISSING');
      expect(mockPool.query).not.toHaveBeenCalled();
    });

    it('enforces IP rate limiting on login when exceeding limit', async () => {
      const rateLimitedApp = createApp(testEnv, {
        dbPool: mockPool as unknown as Pool,
        emailService: mockEmailService as unknown as EmailService,
        loginRateLimitMax: 2,
        csrfRateLimitMax: 100
      });

      mockPool.query.mockResolvedValue({ rows: [] });

      // Request 1
      await request(rateLimitedApp)
        .post('/api/v1/auth/login')
        .set('Origin', 'http://localhost:3000')
        .set('X-CSRF-Token', defaultCsrfToken)
        .set('Cookie', defaultCsrfCookie)
        .send({ email: validEmail, password: 'wrong' })
        .expect(401);

      // Request 2
      await request(rateLimitedApp)
        .post('/api/v1/auth/login')
        .set('Origin', 'http://localhost:3000')
        .set('X-CSRF-Token', defaultCsrfToken)
        .set('Cookie', defaultCsrfCookie)
        .send({ email: validEmail, password: 'wrong' })
        .expect(401);

      // Request 3: 429
      const res = await request(rateLimitedApp)
        .post('/api/v1/auth/login')
        .set('Origin', 'http://localhost:3000')
        .set('X-CSRF-Token', defaultCsrfToken)
        .set('Cookie', defaultCsrfCookie)
        .send({ email: validEmail, password: 'wrong' })
        .expect(429);

      expect(res.body.code).toBe('LOGIN_RATE_LIMIT_EXCEEDED');
    });

    it('ensures passwords, raw session tokens, and token hashes are never exposed in responses or logs', async () => {
      const loggerSpy = vi.spyOn(logger, 'info');

      mockPool.query
        .mockResolvedValueOnce({
          rows: [
            {
              user_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
              email: validEmail,
              full_name: 'Jane Student',
              roles: ['Student'],
              account_status: 'ACTIVE',
              password_hash: passwordHash,
              failed_login_attempts: 0,
              locked_until: null
            }
          ]
        })
        .mockResolvedValueOnce({ rows: [{ failed_attempts: 0, account_locked_until: null }] })
        .mockResolvedValueOnce({ rows: [{ session_id: 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380acc' }] });

      const res = await request(app)
        .post('/api/v1/auth/login')
        .set('Origin', 'http://localhost:3000')
        .set('X-CSRF-Token', defaultCsrfToken)
        .set('Cookie', defaultCsrfCookie)
        .send({ email: validEmail, password: rawPassword })
        .expect(200);

      const cookies = getCookies(res.headers['set-cookie']);
      const sessionCookie = cookies.find((c: string) => c.startsWith('ipr_session='));
      const rawToken = sessionCookie?.split(';')[0]?.replace('ipr_session=', '') || '';
      const tokenHash = computeSha256(rawToken);

      const resString = JSON.stringify(res.body);

      // Check response body
      expect(resString).not.toContain(rawPassword);
      expect(resString).not.toContain(rawToken);
      expect(resString).not.toContain(tokenHash);
      expect(resString).not.toContain(passwordHash);

      // Check log calls
      for (const call of loggerSpy.mock.calls) {
        const logContent = JSON.stringify(call);
        expect(logContent).not.toContain(rawPassword);
        expect(logContent).not.toContain(rawToken);
        expect(logContent).not.toContain(tokenHash);
      }
    });
  });
});
