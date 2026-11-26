import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import type { Pool } from 'pg';
import { InMemoryNonceStore, computeSha256 } from '@ipr/shared';
import { createApp } from '../src/app.js';
import { BackendEnv } from '../src/config/env.config.js';
import { EmailService } from '../src/services/email.service.js';
import { logger } from '../src/config/logger.config.js';

describe('Stage 2F.2D — Verification Email Resend and Recovery', () => {
  let mockPool: { query: ReturnType<typeof vi.fn> };
  let mockEmailService: { sendEmail: ReturnType<typeof vi.fn>; verifyConnection: ReturnType<typeof vi.fn> };
  let app: ReturnType<typeof createApp>;

  const testEnv: BackendEnv = {
    NODE_ENV: 'test',
    PORT: 4004,
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

  const validStudentEmail = 'student.resend@paruluniversity.ac.in';
  let defaultCsrfToken = '';
  let defaultCsrfCookie = '';

  beforeEach(async () => {
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

  describe('1. Valid Resend Request', () => {
    it('successfully reissues token and sends verification email with URL fragment', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ reissued: true, full_name: 'Jane Student' }]
      });

      const res = await request(app)
        .post('/api/v1/auth/resend-verification')
        .set('Origin', 'http://localhost:3000')
        .set('X-CSRF-Token', defaultCsrfToken)
        .set('Cookie', defaultCsrfCookie)
        .send({ email: validStudentEmail })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('verification link has been sent');
      expect(res.body).not.toHaveProperty('token');
      expect(res.body).not.toHaveProperty('tokenHash');

      expect(mockPool.query).toHaveBeenCalledTimes(1);
      const [sql, params] = mockPool.query.mock.calls[0];
      expect(sql).toContain('auth_internal.reissue_pending_verification_token_v1');
      expect(params[0]).toBe('student.resend@paruluniversity.ac.in');
      expect(params[1]).toMatch(/^[a-f0-9]{64}$/); // SHA-256 token hash
      expect(params[2]).toBeInstanceOf(Date);
      expect(params[3]).toBe(60); // default cooldown

      expect(mockEmailService.sendEmail).toHaveBeenCalledTimes(1);
      const [emailTo, emailSubject, emailText] = mockEmailService.sendEmail.mock.calls[0];
      expect(emailTo).toBe('student.resend@paruluniversity.ac.in');
      expect(emailSubject).toContain('Verify your Parul University IPR Portal Account');
      expect(emailText).toContain('http://localhost:3000/verify-email#token=');
      expect(emailText).not.toContain('?token=');
    });

    it('normalizes email address by trimming whitespace and lowercasing', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ reissued: true, full_name: 'Jane Student' }]
      });

      await request(app)
        .post('/api/v1/auth/resend-verification')
        .set('Origin', 'http://localhost:3000')
        .set('X-CSRF-Token', defaultCsrfToken)
        .set('Cookie', defaultCsrfCookie)
        .send({ email: '  STUDENT.RESEND@PARULUNIVERSITY.AC.IN  ' })
        .expect(200);

      const params = mockPool.query.mock.calls[0][1];
      expect(params[0]).toBe('student.resend@paruluniversity.ac.in');
    });
  });

  const expectedGenericResponse = {
    success: true,
    message: 'If an unverified account exists for this email, a verification link has been sent to your institutional inbox.'
  };

  describe('2. Account Enumeration Resistance Across All States', () => {
    it('returns the same generic 200 response for an unknown email address and dispatches no email', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ reissued: false, full_name: null }]
      });

      const res = await request(app)
        .post('/api/v1/auth/resend-verification')
        .set('Origin', 'http://localhost:3000')
        .set('X-CSRF-Token', defaultCsrfToken)
        .set('Cookie', defaultCsrfCookie)
        .send({ email: 'unknown.student@paruluniversity.ac.in' })
        .expect(200);

      expect(res.body).toEqual(expectedGenericResponse);
      expect(mockEmailService.sendEmail).not.toHaveBeenCalled();
    });

    it('returns the same generic 200 response for an already verified user and dispatches no email', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ reissued: false, full_name: null }]
      });

      const res = await request(app)
        .post('/api/v1/auth/resend-verification')
        .set('Origin', 'http://localhost:3000')
        .set('X-CSRF-Token', defaultCsrfToken)
        .set('Cookie', defaultCsrfCookie)
        .send({ email: 'verified.student@paruluniversity.ac.in' })
        .expect(200);

      expect(res.body).toEqual(expectedGenericResponse);
      expect(mockEmailService.sendEmail).not.toHaveBeenCalled();
    });

    it('returns the same generic 200 response during cooldown and silently suppresses email reissuance', async () => {
      // Cooldown active: database routine returns reissued = false
      mockPool.query.mockResolvedValueOnce({
        rows: [{ reissued: false, full_name: null }]
      });

      const res = await request(app)
        .post('/api/v1/auth/resend-verification')
        .set('Origin', 'http://localhost:3000')
        .set('X-CSRF-Token', defaultCsrfToken)
        .set('Cookie', defaultCsrfCookie)
        .send({ email: validStudentEmail })
        .expect(200);

      expect(res.body).toEqual(expectedGenericResponse);
      expect(mockEmailService.sendEmail).not.toHaveBeenCalled();
    });

    it('returns the same generic 200 response even when SMTP delivery fails', async () => {
      const loggerSpy = vi.spyOn(logger, 'error');

      mockPool.query.mockResolvedValueOnce({
        rows: [{ reissued: true, full_name: 'Jane Student' }]
      });
      mockEmailService.sendEmail.mockRejectedValueOnce(new Error('SMTP connection timeout'));

      const res = await request(app)
        .post('/api/v1/auth/resend-verification')
        .set('Origin', 'http://localhost:3000')
        .set('X-CSRF-Token', defaultCsrfToken)
        .set('Cookie', defaultCsrfCookie)
        .send({ email: validStudentEmail })
        .expect(200);

      expect(res.body).toEqual(expectedGenericResponse);
      expect(loggerSpy).toHaveBeenCalled();
    });
  });

  describe('3. Database Cooldown & Concurrency Protection', () => {
    it('handles concurrent resend attempts such that both return generic 200 and only one email is dispatched', async () => {
      // First call acquires row lock and succeeds; second call sees updated last_resend_at and is suppressed
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ reissued: true, full_name: 'Jane' }] })
        .mockResolvedValueOnce({ rows: [{ reissued: false, full_name: null }] });

      const [res1, res2] = await Promise.all([
        request(app)
          .post('/api/v1/auth/resend-verification')
          .set('Origin', 'http://localhost:3000')
          .set('X-CSRF-Token', defaultCsrfToken)
          .set('Cookie', defaultCsrfCookie)
          .send({ email: validStudentEmail }),
        request(app)
          .post('/api/v1/auth/resend-verification')
          .set('Origin', 'http://localhost:3000')
          .set('X-CSRF-Token', defaultCsrfToken)
          .set('Cookie', defaultCsrfCookie)
          .send({ email: validStudentEmail })
      ]);

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);
      expect(res1.body).toEqual(expectedGenericResponse);
      expect(res2.body).toEqual(expectedGenericResponse);
      expect(mockEmailService.sendEmail).toHaveBeenCalledTimes(1);
    });
  });

  describe('4. Token Rotation & Verification Continuity', () => {
    it('proves token rotation invalidates the old token and verifies successfully with the new token', async () => {
      let storedTokenHash = computeSha256('old_token_1234567890123456789012345678901234567890123456789012345678901234');

      // Mock database state transition:
      // 1. Resend rotates token in pending_registrations
      mockPool.query.mockImplementation(async (sql: string, params: unknown[]) => {
        if (sql.includes('auth_internal.reissue_pending_verification_token_v1')) {
          storedTokenHash = params[1] as string; // new token hash stored
          return { rows: [{ reissued: true, full_name: 'Jane Student' }] };
        }
        if (sql.includes('auth_internal.verify_student_registration_v1')) {
          const presentedHash = params[0] as string;
          if (presentedHash !== storedTokenHash) {
            throw new Error('INVALID_OR_EXPIRED_VERIFICATION_TOKEN');
          }
          return { rows: [{ user_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' }] };
        }
        return { rows: [] };
      });

      // 1. Request resend -> rotates token and captures raw token from email
      await request(app)
        .post('/api/v1/auth/resend-verification')
        .set('Origin', 'http://localhost:3000')
        .set('X-CSRF-Token', defaultCsrfToken)
        .set('Cookie', defaultCsrfCookie)
        .send({ email: validStudentEmail })
        .expect(200);

      const emailText = mockEmailService.sendEmail.mock.calls[0][2];
      const match = emailText.match(/#token=([a-f0-9]{64})/);
      expect(match).not.toBeNull();
      const newRawToken = match![1];

      // 2. Old token verification must fail
      const oldRawToken = 'old_token_1234567890123456789012345678901234567890123456789012345678901234';
      await request(app)
        .post('/api/v1/auth/verify-email')
        .set('Origin', 'http://localhost:3000')
        .set('X-CSRF-Token', defaultCsrfToken)
        .set('Cookie', defaultCsrfCookie)
        .send({ token: computeSha256(oldRawToken) }) // 64 hex characters
        .expect(400);

      // 3. New token verification succeeds
      const verifyRes = await request(app)
        .post('/api/v1/auth/verify-email')
        .set('Origin', 'http://localhost:3000')
        .set('X-CSRF-Token', defaultCsrfToken)
        .set('Cookie', defaultCsrfCookie)
        .send({ token: newRawToken })
        .expect(200);

      expect(verifyRes.body.success).toBe(true);
      expect(verifyRes.body.userId).toBe('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');
    });
  });

  describe('5. SMTP Failure and Retry Recovery', () => {
    it('allows retry after cooldown when previous attempt experienced SMTP failure', async () => {
      // 1. Initial resend attempt: database succeeds, but SMTP fails (returns generic 200)
      mockPool.query.mockResolvedValueOnce({
        rows: [{ reissued: true, full_name: 'Jane Student' }]
      });
      mockEmailService.sendEmail.mockRejectedValueOnce(new Error('SMTP connection timeout'));

      const failRes = await request(app)
        .post('/api/v1/auth/resend-verification')
        .set('Origin', 'http://localhost:3000')
        .set('X-CSRF-Token', defaultCsrfToken)
        .set('Cookie', defaultCsrfCookie)
        .send({ email: validStudentEmail })
        .expect(200);

      expect(failRes.body).toEqual(expectedGenericResponse);

      // 2. Retry after cooldown: database reissues new token and SMTP succeeds (returns generic 200)
      mockPool.query.mockResolvedValueOnce({
        rows: [{ reissued: true, full_name: 'Jane Student' }]
      });
      mockEmailService.sendEmail.mockResolvedValueOnce(undefined);

      const successRes = await request(app)
        .post('/api/v1/auth/resend-verification')
        .set('Origin', 'http://localhost:3000')
        .set('X-CSRF-Token', defaultCsrfToken)
        .set('Cookie', defaultCsrfCookie)
        .send({ email: validStudentEmail })
        .expect(200);

      expect(successRes.body).toEqual(expectedGenericResponse);
      expect(mockEmailService.sendEmail).toHaveBeenCalledTimes(2);
    });
  });

  describe('6. Security & Middleware Protections', () => {
    it('rejects non-institutional email domain with 400', async () => {
      const res = await request(app)
        .post('/api/v1/auth/resend-verification')
        .set('Origin', 'http://localhost:3000')
        .set('X-CSRF-Token', defaultCsrfToken)
        .set('Cookie', defaultCsrfCookie)
        .send({ email: 'attacker@gmail.com' })
        .expect(400);

      expect(res.body.code).toBe('SCHEMA_VALIDATION_FAILED');
      expect(mockPool.query).not.toHaveBeenCalled();
    });

    it('rejects requests with missing or invalid Origin header', async () => {
      const res = await request(app)
        .post('/api/v1/auth/resend-verification')
        .set('Origin', 'http://evil.com')
        .set('X-CSRF-Token', defaultCsrfToken)
        .set('Cookie', defaultCsrfCookie)
        .send({ email: validStudentEmail })
        .expect(403);

      expect(res.body.code).toBe('ORIGIN_FORBIDDEN');
      expect(mockPool.query).not.toHaveBeenCalled();
    });

    it('rejects requests with missing or invalid CSRF token', async () => {
      // 1. Missing CSRF header
      const missingRes = await request(app)
        .post('/api/v1/auth/resend-verification')
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', defaultCsrfCookie)
        .send({ email: validStudentEmail })
        .expect(403);

      expect(missingRes.body.code).toBe('CSRF_TOKEN_MISSING');

      // 2. Invalid CSRF header
      const invalidRes = await request(app)
        .post('/api/v1/auth/resend-verification')
        .set('Origin', 'http://localhost:3000')
        .set('X-CSRF-Token', 'invalid-csrf-token')
        .set('Cookie', defaultCsrfCookie)
        .send({ email: validStudentEmail })
        .expect(403);

      expect(invalidRes.body.code).toBe('CSRF_TOKEN_INVALID');
      expect(mockPool.query).not.toHaveBeenCalled();
    });

    it('rejects non-JSON Content-Type with 415', async () => {
      const res = await request(app)
        .post('/api/v1/auth/resend-verification')
        .set('Origin', 'http://localhost:3000')
        .set('X-CSRF-Token', defaultCsrfToken)
        .set('Cookie', defaultCsrfCookie)
        .set('Content-Type', 'text/plain')
        .send(`email=${validStudentEmail}`)
        .expect(415);

      expect(res.body.code).toBe('UNSUPPORTED_MEDIA_TYPE');
      expect(mockPool.query).not.toHaveBeenCalled();
    });

    it('enforces IP rate limiting when exceeding resendRateLimitMax', async () => {
      const rateLimitedApp = createApp(testEnv, {
        dbPool: mockPool as unknown as Pool,
        emailService: mockEmailService as unknown as EmailService,
        resendRateLimitMax: 2,
        csrfRateLimitMax: 100
      });

      mockPool.query.mockResolvedValue({
        rows: [{ reissued: true, full_name: 'Jane' }]
      });

      // Request 1: OK
      await request(rateLimitedApp)
        .post('/api/v1/auth/resend-verification')
        .set('Origin', 'http://localhost:3000')
        .set('X-CSRF-Token', defaultCsrfToken)
        .set('Cookie', defaultCsrfCookie)
        .send({ email: validStudentEmail })
        .expect(200);

      // Request 2: OK
      await request(rateLimitedApp)
        .post('/api/v1/auth/resend-verification')
        .set('Origin', 'http://localhost:3000')
        .set('X-CSRF-Token', defaultCsrfToken)
        .set('Cookie', defaultCsrfCookie)
        .send({ email: validStudentEmail })
        .expect(200);

      // Request 3: 429
      const res = await request(rateLimitedApp)
        .post('/api/v1/auth/resend-verification')
        .set('Origin', 'http://localhost:3000')
        .set('X-CSRF-Token', defaultCsrfToken)
        .set('Cookie', defaultCsrfCookie)
        .send({ email: validStudentEmail })
        .expect(429);

      expect(res.body.code).toBe('RESEND_RATE_LIMIT_EXCEEDED');
    });
  });

  describe('7. Secret & Token Non-Exposure', () => {
    it('ensures raw tokens and hashes are never exposed in API responses or logs', async () => {
      const loggerSpy = vi.spyOn(logger, 'info');

      mockPool.query.mockResolvedValueOnce({
        rows: [{ reissued: true, full_name: 'Jane Student' }]
      });

      const res = await request(app)
        .post('/api/v1/auth/resend-verification')
        .set('Origin', 'http://localhost:3000')
        .set('X-CSRF-Token', defaultCsrfToken)
        .set('Cookie', defaultCsrfCookie)
        .send({ email: validStudentEmail })
        .expect(200);

      const responseString = JSON.stringify(res.body);
      const emailText = mockEmailService.sendEmail.mock.calls[0][2];
      const match = emailText.match(/#token=([a-f0-9]{64})/);
      const rawToken = match![1];
      const tokenHash = computeSha256(rawToken);

      // Raw token and token hash must NOT appear in response body
      expect(responseString).not.toContain(rawToken);
      expect(responseString).not.toContain(tokenHash);

      // Raw token and token hash must NOT appear in any log output
      for (const call of loggerSpy.mock.calls) {
        const logContent = JSON.stringify(call);
        expect(logContent).not.toContain(rawToken);
        expect(logContent).not.toContain(tokenHash);
      }
    });
  });
});
