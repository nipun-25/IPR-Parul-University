import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import type { Pool } from 'pg';
import { InMemoryNonceStore, computeSha256 } from '@ipr/shared';
import { createApp } from '../src/app.js';
import { BackendEnv } from '../src/config/env.config.js';
import { AuthService } from '../src/services/auth.service.js';
import { EmailService } from '../src/services/email.service.js';

describe('Stage 2F.2 — Student Registration & Email Verification', () => {
  let mockPool: { query: ReturnType<typeof vi.fn> };
  let mockEmailService: { sendEmail: ReturnType<typeof vi.fn>; verifyConnection: ReturnType<typeof vi.fn> };
  let app: ReturnType<typeof createApp>;

  const testEnv: BackendEnv = {
    NODE_ENV: 'test',
    PORT: 4003,
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

  const validRegistrationPayload = {
    email: 'student.test@paruluniversity.ac.in',
    fullName: 'Jane Doe',
    password: 'ValidPassword123!'
  };

  beforeEach(() => {
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
  });

  describe('1. Student Registration (POST /api/v1/auth/register)', () => {
    it('successfully registers an institutional student and dispatches verification email', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ registration_id: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a99' }]
      });

      const res = await request(app)
        .post('/api/v1/auth/register')
        .set('Origin', 'http://localhost:3000')
        .send(validRegistrationPayload)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('verification link has been sent');
      expect(res.body).not.toHaveProperty('token');
      expect(res.body).not.toHaveProperty('passwordHash');

      expect(mockPool.query).toHaveBeenCalledTimes(1);
      const [sql, params] = mockPool.query.mock.calls[0];
      expect(sql).toContain('auth_internal.create_pending_registration_v1');
      expect(params[0]).toBe('student.test@paruluniversity.ac.in');
      expect(params[1]).toBe('Jane Doe');
      // Password hash must be Argon2id
      expect(params[2]).toMatch(/^\$argon2id\$/);
      // Token hash must be 64 hex characters (SHA-256)
      expect(params[3]).toMatch(/^[a-f0-9]{64}$/);
      expect(params[4]).toBeInstanceOf(Date);

      expect(mockEmailService.sendEmail).toHaveBeenCalledTimes(1);
      const [emailTo, emailSubject, emailText] = mockEmailService.sendEmail.mock.calls[0];
      expect(emailTo).toBe('student.test@paruluniversity.ac.in');
      expect(emailSubject).toContain('Verify your Parul University IPR Portal Account');
      expect(emailText).toContain('http://localhost:3000/verify-email#token=');
      expect(emailText).not.toContain('?token=');
    });

    it('normalizes email address to lowercase and trims full name', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ registration_id: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a99' }]
      });

      await request(app)
        .post('/api/v1/auth/register')
        .set('Origin', 'http://localhost:3000')
        .send({
          email: '  STUDENT.UPPERCASE@PARULUNIVERSITY.AC.IN  ',
          fullName: '   Dr. John Smith   ',
          password: 'StrongPassword123#'
        })
        .expect(200);

      const [, params] = mockPool.query.mock.calls[0];
      expect(params[0]).toBe('student.uppercase@paruluniversity.ac.in');
      expect(params[1]).toBe('Dr. John Smith');
    });

    it('rejects non-institutional email domains with 400', async () => {
      const invalidEmails = [
        'student@gmail.com',
        'student@yahoo.com',
        'student@parul.ac.in',
        'student@fake-paruluniversity.ac.in',
        'student@paruluniversity.ac.in.attacker.com',
        'notanemail'
      ];

      for (const email of invalidEmails) {
        const res = await request(app)
          .post('/api/v1/auth/register')
          .set('Origin', 'http://localhost:3000')
          .send({ ...validRegistrationPayload, email })
          .expect(400);

        expect(res.body.code).toBe('SCHEMA_VALIDATION_FAILED');
      }

      expect(mockPool.query).not.toHaveBeenCalled();
    });

    it('rejects invalid or empty full name with 400', async () => {
      const invalidNames = ['', '   ', 'A', 'a'.repeat(101)];

      for (const fullName of invalidNames) {
        const res = await request(app)
          .post('/api/v1/auth/register')
          .set('Origin', 'http://localhost:3000')
          .send({ ...validRegistrationPayload, fullName })
          .expect(400);

        expect(res.body.code).toBe('SCHEMA_VALIDATION_FAILED');
      }

      expect(mockPool.query).not.toHaveBeenCalled();
    });

    it('rejects weak passwords failing complexity rules with 400', async () => {
      const weakPasswords = [
        'short1!', // < 8 characters
        'alllowercase123!', // No uppercase
        'ALLUPPERCASE123!', // No lowercase
        'NoSpecialOrNumbers', // No digits or symbols
        'a'.repeat(129) // > 128 characters
      ];

      for (const password of weakPasswords) {
        const res = await request(app)
          .post('/api/v1/auth/register')
          .set('Origin', 'http://localhost:3000')
          .send({ ...validRegistrationPayload, password })
          .expect(400);

        expect(res.body.code).toBe('SCHEMA_VALIDATION_FAILED');
      }

      expect(mockPool.query).not.toHaveBeenCalled();
    });

    it('rejects unexpected additional properties (strict schema)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .set('Origin', 'http://localhost:3000')
        .send({
          ...validRegistrationPayload,
          extraField: 'malicious_input'
        })
        .expect(400);

      expect(res.body.code).toBe('SCHEMA_VALIDATION_FAILED');
      expect(mockPool.query).not.toHaveBeenCalled();
    });

    it('strictly prevents role escalation attempts', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .set('Origin', 'http://localhost:3000')
        .send({
          ...validRegistrationPayload,
          roles: ['Administrator'],
          role: 'Faculty'
        })
        .expect(400);

      expect(res.body.code).toBe('SCHEMA_VALIDATION_FAILED');
      expect(mockPool.query).not.toHaveBeenCalled();
    });

    it('returns generic success on duplicate registered email without revealing existence', async () => {
      mockPool.query.mockRejectedValueOnce(
        new Error('REGISTRATION_NOT_AVAILABLE')
      );

      const res = await request(app)
        .post('/api/v1/auth/register')
        .set('Origin', 'http://localhost:3000')
        .send(validRegistrationPayload)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('verification link has been sent');
      // Must NOT dispatch email for existing user
      expect(mockEmailService.sendEmail).not.toHaveBeenCalled();
    });

    it('returns generic success on duplicate pending registration without revealing existence', async () => {
      mockPool.query.mockRejectedValueOnce(
        Object.assign(new Error('duplicate key value violates unique constraint "uq_pending_registrations_email"'), {
          code: '23505'
        })
      );

      const res = await request(app)
        .post('/api/v1/auth/register')
        .set('Origin', 'http://localhost:3000')
        .send(validRegistrationPayload)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('verification link has been sent');
      expect(mockEmailService.sendEmail).not.toHaveBeenCalled();
    });

    it('returns 503 EMAIL_DELIVERY_FAILED when SMTP transport fails without exposing credentials', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ registration_id: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a99' }]
      });
      mockEmailService.sendEmail.mockRejectedValueOnce(
        new Error('SMTP connection timeout: secretPass999')
      );

      const res = await request(app)
        .post('/api/v1/auth/register')
        .set('Origin', 'http://localhost:3000')
        .send(validRegistrationPayload)
        .expect(503);

      expect(res.body.code).toBe('EMAIL_DELIVERY_FAILED');
      expect(res.body.detail).toBe('Could not send verification email. Please try again later.');
      const responseStr = JSON.stringify(res.body);
      expect(responseStr).not.toContain('secretPass999');
    });

    it('returns 503 DATABASE_UNAVAILABLE when database pool is not configured', async () => {
      const appWithoutDb = createApp(testEnv, {
        emailService: mockEmailService as unknown as EmailService,
        nonceStore: new InMemoryNonceStore()
      });

      const res = await request(appWithoutDb)
        .post('/api/v1/auth/register')
        .set('Origin', 'http://localhost:3000')
        .send(validRegistrationPayload)
        .expect(503);

      expect(res.body.code).toBe('DATABASE_UNAVAILABLE');
    });
  });

  describe('2. Email Verification (POST /api/v1/auth/verify-email)', () => {
    const rawToken = 'a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0';
    const activatedUserId = 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

    it('successfully activates student account with valid verification token', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ user_id: activatedUserId }]
      });

      const res = await request(app)
        .post('/api/v1/auth/verify-email')
        .set('Origin', 'http://localhost:3000')
        .send({ token: rawToken })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.userId).toBe(activatedUserId);
      expect(res.body.message).toContain('account is now active');

      expect(mockPool.query).toHaveBeenCalledTimes(1);
      const [sql, params] = mockPool.query.mock.calls[0];
      expect(sql).toContain('auth_internal.verify_student_registration_v1');
      // Verifier receives SHA-256 hash of token, not raw token
      expect(params[0]).toBe(computeSha256(rawToken));
    });

    it('rejects malformed token format with 400', async () => {
      const invalidTokens = [
        'too-short',
        '12345',
        'g'.repeat(64), // Invalid hex character
        'a'.repeat(63), // 63 chars
        'a'.repeat(65)  // 65 chars
      ];

      for (const token of invalidTokens) {
        const res = await request(app)
          .post('/api/v1/auth/verify-email')
          .set('Origin', 'http://localhost:3000')
          .send({ token })
          .expect(400);

        expect(res.body.code).toBe('SCHEMA_VALIDATION_FAILED');
      }

      expect(mockPool.query).not.toHaveBeenCalled();
    });

    it('rejects invalid or expired token with 400 INVALID_VERIFICATION_TOKEN', async () => {
      mockPool.query.mockRejectedValueOnce(
        new Error('INVALID_OR_EXPIRED_VERIFICATION_TOKEN')
      );

      const res = await request(app)
        .post('/api/v1/auth/verify-email')
        .set('Origin', 'http://localhost:3000')
        .send({ token: rawToken })
        .expect(400);

      expect(res.body.code).toBe('INVALID_VERIFICATION_TOKEN');
      expect(res.body.detail).toContain('invalid, expired, or has already been used');
    });

    it('rejects repeated verification attempt with 400 INVALID_VERIFICATION_TOKEN', async () => {
      mockPool.query.mockRejectedValueOnce(
        new Error('INVALID_OR_EXPIRED_VERIFICATION_TOKEN')
      );

      const res = await request(app)
        .post('/api/v1/auth/verify-email')
        .set('Origin', 'http://localhost:3000')
        .send({ token: rawToken })
        .expect(400);

      expect(res.body.code).toBe('INVALID_VERIFICATION_TOKEN');
    });

    it('returns 503 DATABASE_UNAVAILABLE on database connection drop', async () => {
      mockPool.query.mockRejectedValueOnce(
        Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:5432'), { code: 'ECONNREFUSED' })
      );

      const res = await request(app)
        .post('/api/v1/auth/verify-email')
        .set('Origin', 'http://localhost:3000')
        .send({ token: rawToken })
        .expect(503);

      expect(res.body.code).toBe('DATABASE_UNAVAILABLE');
    });
  });

  describe('3. Security Controls: Rate Limiting & Origin Validation', () => {
    it('blocks state-changing requests with missing Origin header with 403', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send(validRegistrationPayload)
        .expect(403);

      expect(res.body.code).toBe('ORIGIN_FORBIDDEN');
      expect(res.body.detail).toContain('Missing Origin header');
      expect(mockPool.query).not.toHaveBeenCalled();
    });

    it('blocks state-changing requests from unauthorized origins with 403', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .set('Origin', 'http://malicious-site.com')
        .send(validRegistrationPayload)
        .expect(403);

      expect(res.body.code).toBe('ORIGIN_FORBIDDEN');
      expect(res.body.detail).toContain('not authorized');
      expect(mockPool.query).not.toHaveBeenCalled();
    });

    it('enforces IP rate limiting on registration endpoint (429 Too Many Requests)', async () => {
      const rateLimitedApp = createApp(testEnv, {
        dbPool: mockPool as unknown as Pool,
        emailService: mockEmailService as unknown as EmailService,
        nonceStore: new InMemoryNonceStore(),
        registerRateLimitMax: 5
      });

      mockPool.query.mockResolvedValue({
        rows: [{ registration_id: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a99' }]
      });

      // Send 5 requests (within limit)
      for (let i = 0; i < 5; i++) {
        await request(rateLimitedApp)
          .post('/api/v1/auth/register')
          .set('Origin', 'http://localhost:3000')
          .send({
            ...validRegistrationPayload,
            email: `student.${i}@paruluniversity.ac.in`
          })
          .expect(200);
      }

      // 6th request must be rejected with 429
      const res = await request(rateLimitedApp)
        .post('/api/v1/auth/register')
        .set('Origin', 'http://localhost:3000')
        .send({
          ...validRegistrationPayload,
          email: 'student.overflow@paruluniversity.ac.in'
        })
        .expect(429);

      expect(res.body.code).toBe('REGISTRATION_RATE_LIMIT_EXCEEDED');
      expect(res.headers).toHaveProperty('retry-after');
    });
  });

  describe('4. AuthService Unit Functions', () => {
    const authService = new AuthService();

    it('hashes passwords using Argon2id with valid header prefix', async () => {
      const hash = await authService.hashPassword('MySecurePassword123!');
      expect(hash).toMatch(/^\$argon2id\$/);
    });

    it('generates 256-bit cryptographically random token with matching SHA-256 hash', () => {
      const { rawToken, tokenHash } = authService.generateVerificationToken();
      expect(rawToken).toMatch(/^[a-f0-9]{64}$/);
      expect(tokenHash).toBe(computeSha256(rawToken));
    });
  });
});
