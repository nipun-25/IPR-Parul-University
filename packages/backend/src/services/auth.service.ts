import crypto from 'node:crypto';
import argon2 from 'argon2';
import type { Pool } from 'pg';
import {
  RegisterStudentDto,
  VerifyEmailDto,
  RegisterStudentResponseDto,
  VerifyEmailResponseDto,
  ResendVerificationEmailDto,
  ResendVerificationEmailResponseDto,
  LoginDto,
  UserProfileDto,
  SessionResponseDto,
  PortalRole,
  computeSha256,
  generateCsrfToken
} from '@ipr/shared';
import { AppError } from '../middleware/error-handler.middleware.js';
import { EmailService } from './email.service.js';
import { isDatabaseUnavailable } from '../utils/db-error.util.js';
import { logger } from '../config/logger.config.js';

export class AuthService {
  /**
   * Hashes a password using Argon2id with recommended security parameters.
   */
  public async hashPassword(password: string): Promise<string> {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4
    });
  }

  /**
   * Generates a cryptographically secure 256-bit (32 bytes) random verification token
   * and computes its lowercase hexadecimal SHA-256 hash.
   */
  public generateVerificationToken(): { rawToken: string; tokenHash: string } {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = computeSha256(rawToken);
    return { rawToken, tokenHash };
  }

  /**
   * Initiates student registration:
   * 1. Hashes password using Argon2id.
   * 2. Generates 256-bit token and SHA-256 hash.
   * 3. Calls auth_internal.create_pending_registration_v1.
   * 4. Dispatches verification email with raw token link.
   * 5. Returns generic success response to mitigate account enumeration.
   */
  public async registerStudent(
    dbPool: Pool,
    emailService: EmailService,
    corsOrigin: string,
    dto: RegisterStudentDto
  ): Promise<RegisterStudentResponseDto> {
    const normalizedEmail = dto.email.trim().toLowerCase();
    const normalizedFullName = dto.fullName.trim();
    const passwordHash = await this.hashPassword(dto.password);
    const { rawToken, tokenHash } = this.generateVerificationToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    let isEligible = true;

    try {
      await dbPool.query(
        'SELECT auth_internal.create_pending_registration_v1($1::varchar, $2::varchar, $3::text, $4::varchar, $5::timestamptz) AS registration_id',
        [
          normalizedEmail,
          normalizedFullName,
          passwordHash,
          tokenHash,
          expiresAt
        ]
      );
    } catch (err: unknown) {
      if (isDatabaseUnavailable(err)) {
        throw new AppError({
          statusCode: 503,
          code: 'DATABASE_UNAVAILABLE',
          title: 'Database Unavailable',
          detail: 'Database connection failed or service is temporarily unavailable.'
        });
      }

      const errRecord = (typeof err === 'object' && err !== null) ? (err as Record<string, unknown>) : {};
      const errMsg = typeof errRecord.message === 'string' ? errRecord.message : '';

      // Account already exists in portal_users (REGISTRATION_NOT_AVAILABLE)
      // or duplicate pending registration in pending_registrations (23505)
      if (errMsg.includes('REGISTRATION_NOT_AVAILABLE') || errRecord.code === '23505') {
        isEligible = false;
        logger.info(
          { emailDomain: normalizedEmail.split('@')[1] },
          'Registration request for already registered or pending email received (generic response returned)'
        );
      } else if (errMsg.includes('INVALID_STUDENT_EMAIL')) {
        throw new AppError({
          statusCode: 400,
          code: 'INVALID_STUDENT_EMAIL',
          title: 'Invalid Email',
          detail: 'Registration is restricted strictly to @paruluniversity.ac.in student emails.'
        });
      } else {
        throw err;
      }
    }

    if (isEligible) {
      const verificationLink = `${corsOrigin}/verify-email#token=${rawToken}`;
      try {
        await emailService.sendEmail(
          normalizedEmail,
          'Verify your Parul University IPR Portal Account',
          `Hello ${normalizedFullName},\n\nPlease verify your student registration for the Parul University Intellectual Property Rights (IPR) Portal by visiting the following link within 24 hours:\n\n${verificationLink}\n\nIf you did not request this registration, please ignore this email.`,
          `<p>Hello ${normalizedFullName},</p><p>Please verify your student registration for the <strong>Parul University Intellectual Property Rights (IPR) Portal</strong> by clicking the link below (valid for 24 hours):</p><p><a href="${verificationLink}" style="padding: 8px 16px; background-color: #0284c7; color: white; text-decoration: none; border-radius: 4px;">Verify Email</a></p><p>Or copy and paste this link into your browser:<br><code>${verificationLink}</code></p><p>If you did not request this registration, please ignore this email.</p>`
        );
      } catch (err: unknown) {
        logger.error({ err }, 'Failed to dispatch student verification email');
        throw new AppError({
          statusCode: 503,
          code: 'EMAIL_DELIVERY_FAILED',
          title: 'Email Delivery Failed',
          detail: 'Could not send verification email. Please try again later.'
        });
      }
    }

    return {
      success: true,
      message: 'Registration initiated. If this email is eligible for registration, a verification link has been sent to your institutional inbox.'
    };
  }

  /**
   * Verifies student email using the raw verification token:
   * 1. Computes SHA-256 hash of the token.
   * 2. Calls auth_internal.verify_student_registration_v1.
   * 3. Activates student account into portal_users with Student role.
   */
  public async verifyStudentEmail(
    dbPool: Pool,
    dto: VerifyEmailDto
  ): Promise<VerifyEmailResponseDto> {
    const tokenHash = computeSha256(dto.token.trim());

    try {
      const result = await dbPool.query<{ user_id: string }>(
        'SELECT auth_internal.verify_student_registration_v1($1::varchar) AS user_id',
        [tokenHash]
      );

      const userId = result.rows[0]?.user_id;
      if (!userId) {
        throw new Error('Database gateway did not return activated user ID');
      }

      return {
        success: true,
        message: 'Email verified successfully. Your student account is now active.',
        userId
      };
    } catch (err: unknown) {
      if (isDatabaseUnavailable(err)) {
        throw new AppError({
          statusCode: 503,
          code: 'DATABASE_UNAVAILABLE',
          title: 'Database Unavailable',
          detail: 'Database connection failed or service is temporarily unavailable.'
        });
      }

      const errRecord = (typeof err === 'object' && err !== null) ? (err as Record<string, unknown>) : {};
      const errMsg = typeof errRecord.message === 'string' ? errRecord.message : '';

      if (
        errMsg.includes('INVALID_OR_EXPIRED_VERIFICATION_TOKEN') ||
        errMsg.includes('INVALID_VERIFICATION_TOKEN')
      ) {
        throw new AppError({
          statusCode: 400,
          code: 'INVALID_VERIFICATION_TOKEN',
          title: 'Invalid or Expired Token',
          detail: 'The verification token is invalid, expired, or has already been used.'
        });
      }

      throw err;
    }
  }

  /**
   * Resends verification email for a pending student registration:
   * 1. Rotates verification token and updates expiry in auth_internal.reissue_pending_verification_token_v1.
   * 2. Enforces database-backed per-email cooldown (default 60s).
   * 3. Dispatches verification email with raw token link fragment (#token=).
   * 4. Returns generic success response whether email exists, is pending, or already verified.
   */
  public async resendVerificationEmail(
    dbPool: Pool,
    emailService: EmailService,
    corsOrigin: string,
    dto: ResendVerificationEmailDto,
    cooldownSeconds: number = 60
  ): Promise<ResendVerificationEmailResponseDto> {
    const normalizedEmail = dto.email.trim().toLowerCase();
    const { rawToken, tokenHash } = this.generateVerificationToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    let reissued = false;
    let studentName: string | null = null;

    try {
      const result = await dbPool.query<{ reissued: boolean; full_name: string | null }>(
        'SELECT reissued, full_name FROM auth_internal.reissue_pending_verification_token_v1($1::varchar, $2::varchar, $3::timestamptz, $4::integer)',
        [normalizedEmail, tokenHash, expiresAt, cooldownSeconds]
      );
      const row = result.rows[0];
      reissued = row?.reissued === true;
      studentName = row?.full_name ?? null;
    } catch (err: unknown) {
      if (isDatabaseUnavailable(err)) {
        throw new AppError({
          statusCode: 503,
          code: 'DATABASE_UNAVAILABLE',
          title: 'Database Unavailable',
          detail: 'Database connection failed or service is temporarily unavailable.'
        });
      }

      const errRecord = (typeof err === 'object' && err !== null) ? (err as Record<string, unknown>) : {};
      const errMsg = typeof errRecord.message === 'string' ? errRecord.message : '';

      if (errMsg.includes('INVALID_STUDENT_EMAIL')) {
        throw new AppError({
          statusCode: 400,
          code: 'INVALID_STUDENT_EMAIL',
          title: 'Invalid Email',
          detail: 'Verification email resend is restricted strictly to @paruluniversity.ac.in student emails.'
        });
      }

      throw err;
    }

    if (reissued) {
      const displayName = studentName || 'Student';
      const verificationLink = `${corsOrigin}/verify-email#token=${rawToken}`;
      try {
        await emailService.sendEmail(
          normalizedEmail,
          'Verify your Parul University IPR Portal Account',
          `Hello ${displayName},\n\nPlease verify your student registration for the Parul University Intellectual Property Rights (IPR) Portal by visiting the following link within 24 hours:\n\n${verificationLink}\n\nIf you did not request this verification email, please ignore this email.`,
          `<p>Hello ${displayName},</p><p>Please verify your student registration for the <strong>Parul University Intellectual Property Rights (IPR) Portal</strong> by clicking the link below (valid for 24 hours):</p><p><a href="${verificationLink}" style="padding: 8px 16px; background-color: #0284c7; color: white; text-decoration: none; border-radius: 4px;">Verify Email</a></p><p>Or copy and paste this link into your browser:<br><code>${verificationLink}</code></p><p>If you did not request this verification email, please ignore this email.</p>`
        );
      } catch (err: unknown) {
        // Log delivery failure safely without exposing email, token, or token hash.
        // Return the same generic response to prevent account enumeration.
        logger.error({ err }, 'Failed to dispatch student verification resend email');
      }
    } else {
      logger.info(
        { emailDomain: normalizedEmail.split('@')[1] },
        'Resend verification requested for non-pending, already-verified, or cooldown-active email (generic response returned)'
      );
    }

    return {
      success: true,
      message: 'If an unverified account exists for this email, a verification link has been sent to your institutional inbox.'
    };
  }

  private dummyPasswordHash: string | null = null;

  /**
   * Lazily computes and caches a valid Argon2id hash of a dummy password
   * to ensure constant-time response for nonexistent accounts or locked accounts.
   */
  public async getDummyPasswordHash(): Promise<string> {
    if (!this.dummyPasswordHash) {
      this.dummyPasswordHash = await this.hashPassword('__timing_safe_dummy_password_for_enumeration_prevention__');
    }
    return this.dummyPasswordHash;
  }

  /**
   * Authenticates user with email and password:
   * 1. Fetches credentials via auth_internal.get_login_credentials_v1.
   * 2. Enforces Argon2id verification with timing attack mitigation.
   * 3. Enforces database lockout policy via auth_internal.record_login_attempt_v1.
   * 4. Creates session via auth_internal.create_user_session_v1 with SHA-256 token hash.
   * 5. Returns authenticated user profile and raw session token for cookie assignment.
   */
  public async login(
    dbPool: Pool,
    dto: LoginDto,
    csrfSecret: string
  ): Promise<{
    user: UserProfileDto;
    rawSessionToken: string;
    sessionExpiresAt: Date;
    csrfToken: string;
  }> {
    const normalizedEmail = dto.email.trim().toLowerCase();

    let userRow: {
      user_id: string;
      email: string;
      full_name: string;
      roles: string[];
      account_status: string;
      password_hash: string;
      failed_login_attempts: number;
      locked_until: string | null;
    } | null = null;

    try {
      const result = await dbPool.query<{
        user_id: string;
        email: string;
        full_name: string;
        roles: string[];
        account_status: string;
        password_hash: string;
        failed_login_attempts: number;
        locked_until: string | null;
      }>(
        'SELECT user_id, email, full_name, roles, account_status, password_hash, failed_login_attempts, locked_until FROM auth_internal.get_login_credentials_v1($1::varchar)',
        [normalizedEmail]
      );
      userRow = result.rows[0] ?? null;
    } catch (err: unknown) {
      if (isDatabaseUnavailable(err)) {
        throw new AppError({
          statusCode: 503,
          code: 'DATABASE_UNAVAILABLE',
          title: 'Database Unavailable',
          detail: 'Database connection failed or service is temporarily unavailable.'
        });
      }
      throw err;
    }

    // 1. Unknown user or unverified registration in pending_registrations
    if (!userRow) {
      const dummyHash = await this.getDummyPasswordHash();
      await argon2.verify(dummyHash, dto.password).catch(() => false);
      throw new AppError({
        statusCode: 401,
        code: 'INVALID_CREDENTIALS',
        title: 'Authentication Failed',
        detail: 'Invalid institutional email or password.'
      });
    }

    // 2. Account Lockout check (5 consecutive failed attempts lock for 15 minutes)
    const isLocked = userRow.locked_until && new Date(userRow.locked_until).getTime() > Date.now();
    if (isLocked) {
      // Perform dummy verify to equalize response timing
      await argon2.verify(userRow.password_hash, dto.password).catch(() => false);
      throw new AppError({
        statusCode: 401,
        code: 'INVALID_CREDENTIALS',
        title: 'Authentication Failed',
        detail: 'Invalid institutional email or password.'
      });
    }

    // 3. Argon2id password verification
    const isPasswordValid = await argon2.verify(userRow.password_hash, dto.password);
    if (!isPasswordValid) {
      // Record failed attempt in database
      try {
        await dbPool.query(
          'SELECT failed_attempts, account_locked_until FROM auth_internal.record_login_attempt_v1($1::uuid, $2::boolean)',
          [userRow.user_id, false]
        );
      } catch (err: unknown) {
        logger.error({ err }, 'Failed to record failed login attempt in database');
      }

      throw new AppError({
        statusCode: 401,
        code: 'INVALID_CREDENTIALS',
        title: 'Authentication Failed',
        detail: 'Invalid institutional email or password.'
      });
    }

    // 4. Verify account is ACTIVE
    if (userRow.account_status !== 'ACTIVE') {
      throw new AppError({
        statusCode: 401,
        code: 'INVALID_CREDENTIALS',
        title: 'Authentication Failed',
        detail: 'Invalid institutional email or password.'
      });
    }

    // 5. Successful login: reset failed login attempts
    try {
      await dbPool.query(
        'SELECT failed_attempts, account_locked_until FROM auth_internal.record_login_attempt_v1($1::uuid, $2::boolean)',
        [userRow.user_id, true]
      );
    } catch (err: unknown) {
      logger.error({ err }, 'Failed to reset login attempts on success');
    }

    // 6. Create authenticated session
    const rawSessionToken = crypto.randomBytes(32).toString('hex'); // 64 hex characters
    const sessionTokenHash = computeSha256(rawSessionToken);
    const sessionExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    let sessionId: string;
    try {
      const sessionResult = await dbPool.query<{ session_id: string }>(
        'SELECT auth_internal.create_user_session_v1($1::uuid, $2::varchar, $3::timestamptz) AS session_id',
        [userRow.user_id, sessionTokenHash, sessionExpiresAt]
      );
      const row = sessionResult.rows[0];
      if (!row?.session_id) {
        throw new Error('Database gateway did not return session ID');
      }
      sessionId = row.session_id;
    } catch (err: unknown) {
      if (isDatabaseUnavailable(err)) {
        throw new AppError({
          statusCode: 503,
          code: 'DATABASE_UNAVAILABLE',
          title: 'Database Unavailable',
          detail: 'Database connection failed or service is temporarily unavailable.'
        });
      }
      throw err;
    }

    // 7. Generate session-bound CSRF token
    const csrfToken = generateCsrfToken(sessionId, csrfSecret);

    return {
      user: {
        id: userRow.user_id,
        puUid: userRow.user_id,
        email: userRow.email,
        fullName: userRow.full_name,
        activeRoles: userRow.roles as PortalRole[],
        isActive: true
      },
      rawSessionToken,
      sessionExpiresAt,
      csrfToken
    };
  }

  /**
   * Validates an existing session token using auth_internal.validate_user_session_v1:
   * Returns session details and user profile, or null if expired/revoked/invalid.
   */
  public async validateSession(
    dbPool: Pool,
    rawSessionToken: string,
    csrfSecret: string
  ): Promise<SessionResponseDto | null> {
    if (!rawSessionToken || rawSessionToken.length !== 64 || !/^[a-f0-9]{64}$/i.test(rawSessionToken)) {
      return null;
    }

    const sessionTokenHash = computeSha256(rawSessionToken);

    try {
      const result = await dbPool.query<{
        session_id: string;
        user_id: string;
        email: string;
        full_name: string;
        roles: string[];
        expires_at: string;
      }>(
        'SELECT session_id, user_id, email, full_name, roles, expires_at FROM auth_internal.validate_user_session_v1($1::varchar)',
        [sessionTokenHash]
      );

      const row = result.rows[0];
      if (!row) {
        return null;
      }

      const csrfToken = generateCsrfToken(row.session_id, csrfSecret);

      return {
        authenticated: true,
        sessionId: row.session_id,
        expiresAt: new Date(row.expires_at).toISOString(),
        csrfToken,
        user: {
          id: row.user_id,
          email: row.email,
          fullName: row.full_name,
          activeRoles: row.roles as PortalRole[]
        }
      };
    } catch (err: unknown) {
      if (isDatabaseUnavailable(err)) {
        throw new AppError({
          statusCode: 503,
          code: 'DATABASE_UNAVAILABLE',
          title: 'Database Unavailable',
          detail: 'Database connection failed or service is temporarily unavailable.'
        });
      }
      throw err;
    }
  }

  /**
   * Revokes an existing session token using auth_internal.revoke_user_session_v1.
   */
  public async logout(dbPool: Pool, rawSessionToken?: string): Promise<void> {
    if (!rawSessionToken || rawSessionToken.length !== 64 || !/^[a-f0-9]{64}$/i.test(rawSessionToken)) {
      return;
    }

    const sessionTokenHash = computeSha256(rawSessionToken);

    try {
      await dbPool.query(
        'SELECT auth_internal.revoke_user_session_v1($1::varchar)',
        [sessionTokenHash]
      );
    } catch (err: unknown) {
      if (isDatabaseUnavailable(err)) {
        throw new AppError({
          statusCode: 503,
          code: 'DATABASE_UNAVAILABLE',
          title: 'Database Unavailable',
          detail: 'Database connection failed or service is temporarily unavailable.'
        });
      }
      logger.error({ err }, 'Failed to revoke session during logout');
    }
  }
}
