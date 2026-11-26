import { Request, Response, NextFunction } from 'express';
import type { Pool } from 'pg';
import { RegisterStudentSchema, VerifyEmailSchema } from '@ipr/shared';
import { AppError } from '../middleware/error-handler.middleware.js';
import { AuthService } from '../services/auth.service.js';
import { EmailService } from '../services/email.service.js';

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
