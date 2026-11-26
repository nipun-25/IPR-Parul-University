import crypto from 'node:crypto';
import argon2 from 'argon2';
import type { Pool } from 'pg';
import {
  RegisterStudentDto,
  VerifyEmailDto,
  RegisterStudentResponseDto,
  VerifyEmailResponseDto,
  computeSha256
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
}
