import express, { Router } from 'express';
import type { Pool } from 'pg';
import { EmailService } from '../services/email.service.js';
import { AuthService } from '../services/auth.service.js';
import { registerStudentHandler, verifyEmailHandler } from '../controllers/auth.controller.js';
import { createRateLimiter } from '../middleware/rate-limiter.middleware.js';
import { createOriginValidator } from '../middleware/origin-validator.middleware.js';

export interface AuthRouterOptions {
  readonly dbPool?: Pool;
  readonly emailService?: EmailService;
  readonly corsOrigin: string;
  readonly authService?: AuthService;
  readonly registerRateLimitMax?: number;
  readonly verifyRateLimitMax?: number;
}

export function createAuthRouter(options: AuthRouterOptions): Router {
  const router = express.Router();

  const originValidator = createOriginValidator(options.corsOrigin);

  // Rate limiters:
  // Registration: max requests per 15 minutes per IP (defaults to 5 in production)
  const registerRateLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    maxRequests: options.registerRateLimitMax ?? 5,
    message: 'Too many registration requests from this IP. Please try again after 15 minutes.',
    code: 'REGISTRATION_RATE_LIMIT_EXCEEDED'
  });

  // Verification: max requests per 15 minutes per IP (defaults to 10 in production)
  const verifyRateLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    maxRequests: options.verifyRateLimitMax ?? 10,
    message: 'Too many verification attempts from this IP. Please try again after 15 minutes.',
    code: 'VERIFICATION_RATE_LIMIT_EXCEEDED'
  });

  router.post(
    '/register',
    originValidator,
    registerRateLimiter,
    registerStudentHandler(options.dbPool, options.emailService, options.corsOrigin, options.authService)
  );

  router.post(
    '/verify-email',
    originValidator,
    verifyRateLimiter,
    verifyEmailHandler(options.dbPool, options.authService)
  );

  return router;
}
