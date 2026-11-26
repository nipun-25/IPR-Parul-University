import { Request, Response, NextFunction } from 'express';
import type { Pool } from 'pg';
import {
  RegisterStudentSchema,
  VerifyEmailSchema,
  ResendVerificationEmailSchema,
  LoginSchema,
  parseCookies
} from '@ipr/shared';
import { AppError } from '../middleware/error-handler.middleware.js';
import { AuthService } from '../services/auth.service.js';
import { EmailService } from '../services/email.service.js';
import {
  setSessionCookie,
  clearSessionCookie,
  SESSION_COOKIE_NAME
} from '../utils/cookie.util.js';

export function registerStudentHandler(
  dbPool?: Pool,
  emailService?: EmailService,
  corsOrigin: string = 'http://localhost:3000',
  authService: AuthService = new AuthService()
) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!dbPool) {
        throw new AppError({
          statusCode: 503,
          code: 'DATABASE_UNAVAILABLE',
          title: 'Database Unavailable',
          detail: 'Database connection pool is not configured.'
        });
      }

      if (!emailService) {
        throw new AppError({
          statusCode: 503,
          code: 'EMAIL_SERVICE_UNAVAILABLE',
          title: 'Email Service Unavailable',
          detail: 'Email service is not configured.'
        });
      }

      const parseResult = RegisterStudentSchema.safeParse(req.body);
      if (!parseResult.success) {
        throw parseResult.error;
      }

      const result = await authService.registerStudent(
        dbPool,
        emailService,
        corsOrigin,
        parseResult.data
      );

      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };
}

export function verifyEmailHandler(
  dbPool?: Pool,
  authService: AuthService = new AuthService()
) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!dbPool) {
        throw new AppError({
          statusCode: 503,
          code: 'DATABASE_UNAVAILABLE',
          title: 'Database Unavailable',
          detail: 'Database connection pool is not configured.'
        });
      }

      const parseResult = VerifyEmailSchema.safeParse(req.body);
      if (!parseResult.success) {
        throw parseResult.error;
      }

      const result = await authService.verifyStudentEmail(
        dbPool,
        parseResult.data
      );

      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };
}

export function resendVerificationHandler(
  dbPool?: Pool,
  emailService?: EmailService,
  corsOrigin: string = 'http://localhost:3000',
  authService: AuthService = new AuthService()
) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!dbPool) {
        throw new AppError({
          statusCode: 503,
          code: 'DATABASE_UNAVAILABLE',
          title: 'Database Unavailable',
          detail: 'Database connection pool is not configured.'
        });
      }

      if (!emailService) {
        throw new AppError({
          statusCode: 503,
          code: 'EMAIL_SERVICE_UNAVAILABLE',
          title: 'Email Service Unavailable',
          detail: 'Email service is not configured.'
        });
      }

      const parseResult = ResendVerificationEmailSchema.safeParse(req.body);
      if (!parseResult.success) {
        throw parseResult.error;
      }

      const result = await authService.resendVerificationEmail(
        dbPool,
        emailService,
        corsOrigin,
        parseResult.data
      );

      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };
}

export function loginHandler(
  dbPool?: Pool,
  authService: AuthService = new AuthService(),
  csrfSecret?: string,
  isProduction: boolean = false
) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!dbPool) {
        throw new AppError({
          statusCode: 503,
          code: 'DATABASE_UNAVAILABLE',
          title: 'Database Unavailable',
          detail: 'Database connection pool is not configured.'
        });
      }

      if (!csrfSecret) {
        throw new AppError({
          statusCode: 500,
          code: 'INTERNAL_SERVER_ERROR',
          title: 'Security Configuration Error',
          detail: 'CSRF secret is not configured.'
        });
      }

      const parseResult = LoginSchema.safeParse(req.body);
      if (!parseResult.success) {
        throw parseResult.error;
      }

      const result = await authService.login(
        dbPool,
        parseResult.data,
        csrfSecret
      );

      // Issue raw session token strictly via Secure, HttpOnly cookie
      setSessionCookie(res, result.rawSessionToken, isProduction, result.sessionExpiresAt);

      res.status(200).json({
        success: true,
        user: result.user,
        csrfToken: result.csrfToken
      });
    } catch (err) {
      next(err);
    }
  };
}

export function sessionHandler(
  dbPool?: Pool,
  authService: AuthService = new AuthService(),
  csrfSecret?: string,
  isProduction: boolean = false
) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!dbPool) {
        throw new AppError({
          statusCode: 503,
          code: 'DATABASE_UNAVAILABLE',
          title: 'Database Unavailable',
          detail: 'Database connection pool is not configured.'
        });
      }

      if (!csrfSecret) {
        throw new AppError({
          statusCode: 500,
          code: 'INTERNAL_SERVER_ERROR',
          title: 'Security Configuration Error',
          detail: 'CSRF secret is not configured.'
        });
      }

      const cookies = parseCookies(req.headers.cookie);
      const sessionToken = cookies[SESSION_COOKIE_NAME];

      if (!sessionToken) {
        res.status(401).json({
          authenticated: false,
          error: 'UNAUTHENTICATED',
          message: 'No active session found.'
        });
        return;
      }

      const session = await authService.validateSession(dbPool, sessionToken, csrfSecret);
      if (!session) {
        clearSessionCookie(res, isProduction);
        res.status(401).json({
          authenticated: false,
          error: 'UNAUTHENTICATED',
          message: 'Session is invalid or has expired.'
        });
        return;
      }

      res.status(200).json(session);
    } catch (err) {
      next(err);
    }
  };
}

export function logoutHandler(
  dbPool?: Pool,
  authService: AuthService = new AuthService(),
  isProduction: boolean = false
) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const cookies = parseCookies(req.headers.cookie);
      const sessionToken = cookies[SESSION_COOKIE_NAME];

      if (dbPool && sessionToken) {
        await authService.logout(dbPool, sessionToken);
      }

      clearSessionCookie(res, isProduction);

      res.status(200).json({
        success: true,
        message: 'Logged out successfully.'
      });
    } catch (err) {
      next(err);
    }
  };
}
