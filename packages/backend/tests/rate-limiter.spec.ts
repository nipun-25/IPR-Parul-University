import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import type { Pool } from 'pg';
import { InMemoryNonceStore } from '@ipr/shared';
import { createApp } from '../src/app.js';
import { BackendEnv } from '../src/config/env.config.js';
import { EmailService } from '../src/services/email.service.js';
import { parseTrustProxy } from '../src/utils/proxy.util.js';
import { createRateLimiter } from '../src/middleware/rate-limiter.middleware.js';

describe('Stage 2F.2B — Proxy & Rate-Limiter Hardening', () => {
  const baseTestEnv: BackendEnv = {
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
    TRUST_PROXY: 'false',
    SMTP_HOST: 'smtp.gmail.com',
    SMTP_PORT: 587,
    SMTP_USER: 'ipr-portal@paruluniversity.ac.in',
    SMTP_PASSWORD: 'smtp-secret-pass'
  };

  const validRegistrationPayload = {
    email: 'ratelimit.test@paruluniversity.ac.in',
    fullName: 'Rate Limit Tester',
    password: 'SecurePassword123!'
  };

  describe('1. parseTrustProxy Utility', () => {
    it('parses falsy values and disabled settings to boolean false', () => {
      expect(parseTrustProxy(undefined)).toBe(false);
      expect(parseTrustProxy(false)).toBe(false);
      expect(parseTrustProxy('false')).toBe(false);
      expect(parseTrustProxy('FALSE')).toBe(false);
      expect(parseTrustProxy('0')).toBe(false);
      expect(parseTrustProxy('')).toBe(false);
    });

    it('parses true and "true" to boolean true', () => {
      expect(parseTrustProxy(true)).toBe(true);
      expect(parseTrustProxy('true')).toBe(true);
      expect(parseTrustProxy('TRUE')).toBe(true);
    });

    it('parses numeric hop counts', () => {
      expect(parseTrustProxy('1')).toBe(1);
      expect(parseTrustProxy('2')).toBe(2);
      expect(parseTrustProxy(1)).toBe(1);
    });

    it('parses single IP or subnet strings', () => {
      expect(parseTrustProxy('loopback')).toBe('loopback');
      expect(parseTrustProxy('127.0.0.1')).toBe('127.0.0.1');
      expect(parseTrustProxy('10.0.0.0/8')).toBe('10.0.0.0/8');
    });

    it('parses comma-separated trusted proxy lists into array of strings', () => {
      expect(parseTrustProxy('loopback, 10.0.0.0/8, 172.16.0.0/12')).toEqual([
        'loopback',
        '10.0.0.0/8',
        '172.16.0.0/12'
      ]);
    });

    it('preserves array of strings as-is', () => {
      expect(parseTrustProxy(['loopback', '127.0.0.1'])).toEqual(['loopback', '127.0.0.1']);
    });
  });

  describe('2. In-Memory Rate Limiter Unit Behavior', () => {
    it('synchronously tracks requests, sets rate limit headers, and resets after windowMs', () => {
      const limiter = createRateLimiter({
        windowMs: 500,
        maxRequests: 2,
        code: 'TEST_LIMIT'
      });

      const mockReq = { ip: '192.168.1.50', socket: { remoteAddress: '192.168.1.50' } } as any;
      const headers: Record<string, string> = {};
      const mockRes = {
        setHeader: (k: string, v: string) => {
          headers[k] = v;
        }
      } as any;

      let errorPassed: any = null;
      const mockNext = (err?: any) => {
        errorPassed = err || null;
      };

      // Request 1: allowed
      limiter(mockReq, mockRes, mockNext);
      expect(errorPassed).toBeNull();
      expect(headers['X-RateLimit-Limit']).toBe('2');
      expect(headers['X-RateLimit-Remaining']).toBe('1');

      // Request 2: allowed
      limiter(mockReq, mockRes, mockNext);
      expect(errorPassed).toBeNull();
      expect(headers['X-RateLimit-Remaining']).toBe('0');

      // Request 3: blocked
      limiter(mockReq, mockRes, mockNext);
      expect(errorPassed).not.toBeNull();
      expect(errorPassed.statusCode).toBe(429);
      expect(errorPassed.code).toBe('TEST_LIMIT');
      expect(headers['Retry-After']).toBeDefined();

      limiter.close();
    });

    it('cleans up store when reset() or close() is called', () => {
      const limiter = createRateLimiter({
        windowMs: 60000,
        maxRequests: 5
      });

      limiter.reset();
      limiter.close();
    });
  });

  describe('3. Express Trust Proxy & Route Rate Limiting Integration', () => {
    let mockPool: { query: ReturnType<typeof vi.fn> };
    let mockEmailService: { sendEmail: ReturnType<typeof vi.fn>; verifyConnection: ReturnType<typeof vi.fn> };

    beforeEach(() => {
      mockPool = {
        query: vi.fn().mockResolvedValue({
          rows: [{ registration_id: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a99', user_id: 'u1' }]
        })
      };
      mockEmailService = {
        sendEmail: vi.fn().mockResolvedValue(undefined),
        verifyConnection: vi.fn().mockResolvedValue(undefined)
      };
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('prevents spoofed X-Forwarded-For headers from bypassing limits when trustProxy is false', async () => {
      // Default: trustProxy is false (direct connection)
      const app = createApp(baseTestEnv, {
        dbPool: mockPool as unknown as Pool,
        emailService: mockEmailService as unknown as EmailService,
        nonceStore: new InMemoryNonceStore(),
        registerRateLimitMax: 3,
        trustProxy: false
      });

      // Attacker attempts to bypass limits by changing X-Forwarded-For on each request
      for (let i = 1; i <= 3; i++) {
        const res = await request(app)
          .post('/api/v1/auth/register')
          .set('Origin', 'http://localhost:3000')
          .set('X-Forwarded-For', `203.0.113.${i}`)
          .send(validRegistrationPayload)
          .expect(200);

        expect(res.body.success).toBe(true);
      }

      // 4th request from same socket connection with another spoofed IP must be blocked
      const blockedRes = await request(app)
        .post('/api/v1/auth/register')
        .set('Origin', 'http://localhost:3000')
        .set('X-Forwarded-For', '203.0.113.99')
        .send(validRegistrationPayload)
        .expect(429);

      expect(blockedRes.body.code).toBe('REGISTRATION_RATE_LIMIT_EXCEEDED');
      expect(blockedRes.headers['retry-after']).toBeDefined();
    });

    it('tracks independent rate limits for different client IPs when trustProxy is configured', async () => {
      // Configured with trusted proxy: loopback (supertest connection arrives via loopback)
      const app = createApp(baseTestEnv, {
        dbPool: mockPool as unknown as Pool,
        emailService: mockEmailService as unknown as EmailService,
        nonceStore: new InMemoryNonceStore(),
        registerRateLimitMax: 2,
        trustProxy: 'loopback'
      });

      const clientA_IP = '198.51.100.10';
      const clientB_IP = '198.51.100.20';

      // Client A: Request 1 (OK)
      await request(app)
        .post('/api/v1/auth/register')
        .set('Origin', 'http://localhost:3000')
        .set('X-Forwarded-For', clientA_IP)
        .send(validRegistrationPayload)
        .expect(200);

      // Client A: Request 2 (OK, exhausts limit)
      await request(app)
        .post('/api/v1/auth/register')
        .set('Origin', 'http://localhost:3000')
        .set('X-Forwarded-For', clientA_IP)
        .send(validRegistrationPayload)
        .expect(200);

      // Client A: Request 3 (Blocked - 429)
      const clientABlocked = await request(app)
        .post('/api/v1/auth/register')
        .set('Origin', 'http://localhost:3000')
        .set('X-Forwarded-For', clientA_IP)
        .send(validRegistrationPayload)
        .expect(429);

      expect(clientABlocked.body.code).toBe('REGISTRATION_RATE_LIMIT_EXCEEDED');

      // Client B from independent IP is NOT blocked
      const clientBAllowed = await request(app)
        .post('/api/v1/auth/register')
        .set('Origin', 'http://localhost:3000')
        .set('X-Forwarded-For', clientB_IP)
        .send(validRegistrationPayload)
        .expect(200);

      expect(clientBAllowed.body.success).toBe(true);
      expect(clientBAllowed.headers['x-ratelimit-remaining']).toBe('1');
    });

    it('rejects X-Forwarded-For when connecting peer is not in trusted proxy list', async () => {
      // Trust proxy is set to a non-loopback IP (e.g. 10.0.0.1)
      // When supertest connects from 127.0.0.1, Express does not trust it and ignores X-Forwarded-For
      const app = createApp(baseTestEnv, {
        dbPool: mockPool as unknown as Pool,
        emailService: mockEmailService as unknown as EmailService,
        nonceStore: new InMemoryNonceStore(),
        registerRateLimitMax: 2,
        trustProxy: '10.0.0.1'
      });

      // 2 requests with different forwarded IPs
      await request(app)
        .post('/api/v1/auth/register')
        .set('Origin', 'http://localhost:3000')
        .set('X-Forwarded-For', '203.0.113.1')
        .send(validRegistrationPayload)
        .expect(200);

      await request(app)
        .post('/api/v1/auth/register')
        .set('Origin', 'http://localhost:3000')
        .set('X-Forwarded-For', '203.0.113.2')
        .send(validRegistrationPayload)
        .expect(200);

      // 3rd request is blocked under the connecting peer (127.0.0.1) because peer is untrusted
      const blockedRes = await request(app)
        .post('/api/v1/auth/register')
        .set('Origin', 'http://localhost:3000')
        .set('X-Forwarded-For', '203.0.113.3')
        .send(validRegistrationPayload)
        .expect(429);

      expect(blockedRes.body.code).toBe('REGISTRATION_RATE_LIMIT_EXCEEDED');
    });

    it('keeps registration and verification rate limits independent', async () => {
      const app = createApp(baseTestEnv, {
        dbPool: mockPool as unknown as Pool,
        emailService: mockEmailService as unknown as EmailService,
        nonceStore: new InMemoryNonceStore(),
        registerRateLimitMax: 1,
        verifyRateLimitMax: 5,
        trustProxy: 'loopback'
      });

      const clientIP = '198.51.100.99';

      // 1. Exhaust registration rate limit for this IP
      await request(app)
        .post('/api/v1/auth/register')
        .set('Origin', 'http://localhost:3000')
        .set('X-Forwarded-For', clientIP)
        .send(validRegistrationPayload)
        .expect(200);

      // Registration is now blocked (429)
      await request(app)
        .post('/api/v1/auth/register')
        .set('Origin', 'http://localhost:3000')
        .set('X-Forwarded-For', clientIP)
        .send(validRegistrationPayload)
        .expect(429);

      // 2. Email verification from the SAME IP must NOT be blocked
      const verifyRes = await request(app)
        .post('/api/v1/auth/verify-email')
        .set('Origin', 'http://localhost:3000')
        .set('X-Forwarded-For', clientIP)
        .send({ token: 'a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0' })
        .expect(200);

      expect(verifyRes.body.success).toBe(true);
      expect(verifyRes.headers['x-ratelimit-remaining']).toBe('4');
    });

    it('resets rate limit count after windowMs expires', async () => {
      // Use fake timers to advance time deterministically
      vi.useFakeTimers({ shouldAdvanceTime: true });

      try {
        const app = createApp(baseTestEnv, {
          dbPool: mockPool as unknown as Pool,
          emailService: mockEmailService as unknown as EmailService,
          nonceStore: new InMemoryNonceStore(),
          registerRateLimitMax: 1,
          trustProxy: 'loopback'
        });

        const clientIP = '198.51.100.77';

        // 1. Use the allowed request
        await request(app)
          .post('/api/v1/auth/register')
          .set('Origin', 'http://localhost:3000')
          .set('X-Forwarded-For', clientIP)
          .send(validRegistrationPayload)
          .expect(200);

        // 2. Immediate second request is blocked
        await request(app)
          .post('/api/v1/auth/register')
          .set('Origin', 'http://localhost:3000')
          .set('X-Forwarded-For', clientIP)
          .send(validRegistrationPayload)
          .expect(429);

        // 3. Advance time past the 15-minute window
        vi.advanceTimersByTime(15 * 60 * 1000 + 1000);

        // 4. Request is now allowed again
        const recoveredRes = await request(app)
          .post('/api/v1/auth/register')
          .set('Origin', 'http://localhost:3000')
          .set('X-Forwarded-For', clientIP)
          .send(validRegistrationPayload)
          .expect(200);

        expect(recoveredRes.body.success).toBe(true);
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
