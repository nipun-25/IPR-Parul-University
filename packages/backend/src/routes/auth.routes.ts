import express, { Router } from 'express';
import type { Pool } from 'pg';
import { EmailService } from '../services/email.service.js';
import { AuthService } from '../services/auth.service.js';
import {
  registerStudentHandler,
  verifyEmailHandler,
  resendVerificationHandler,
  loginHandler,
  sessionHandler,
  logoutHandler
} from '../controllers/auth.controller.js';
import { createCsrfBootstrapHandler } from '../controllers/csrf.controller.js';
import { createRateLimiter } from '../middleware/rate-limiter.middleware.js';
import { createOriginValidator } from '../middleware/origin-validator.middleware.js';
import { createPreAuthCsrfMiddleware } from '../middleware/pre-auth-csrf.middleware.js';

export interface AuthRouterOptions {
  readonly dbPool?: Pool;
  readonly emailService?: EmailService;
  readonly corsOrigin: string;
  readonly authService?: AuthService;
  readonly registerRateLimitMax?: number;
  readonly verifyRateLimitMax?: number;
  readonly resendRateLimitMax?: number;
  readonly loginRateLimitMax?: number;
  readonly csrfRateLimitMax?: number;
  readonly csrfSecret: string;
  readonly isProduction?: boolean;
}

export function createAuthRouter(options: AuthRouterOptions): Router {
  const router = express.Router();

  const originValidator = createOriginValidator(options.corsOrigin);
  const preAuthCsrfMiddleware = createPreAuthCsrfMiddleware({ csrfSecret: options.csrfSecret });

  // Rate limiters:
  // CSRF Bootstrap: max requests per minute per IP (defaults to 30 in production)
  const csrfRateLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    maxRequests: options.csrfRateLimitMax ?? 30,
    message: 'Too many CSRF bootstrap requests. Please try again later.',
    code: 'CSRF_RATE_LIMIT_EXCEEDED'
  });

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

  // Resend Verification: max requests per 15 minutes per IP (defaults to 5 in production)
  const resendRateLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    maxRequests: options.resendRateLimitMax ?? 5,
    message: 'Too many verification resend requests from this IP. Please try again after 15 minutes.',
    code: 'RESEND_RATE_LIMIT_EXCEEDED'
  });

  // Login: max requests per 15 minutes per IP (defaults to 5 in production)
  const loginRateLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    maxRequests: options.loginRateLimitMax ?? 5,
    message: 'Too many login attempts from this IP. Please try again after 15 minutes.',
    code: 'LOGIN_RATE_LIMIT_EXCEEDED'
  });

  // Bootstrap pre-auth CSRF token & cookie
  router.get(
    '/csrf',
    csrfRateLimiter,
    createCsrfBootstrapHandler({
      csrfSecret: options.csrfSecret,
      isProduction: options.isProduction ?? false
    })
  );

  router.post(
    '/register',
    originValidator,
    preAuthCsrfMiddleware,
    registerRateLimiter,
    registerStudentHandler(options.dbPool, options.emailService, options.corsOrigin, options.authService)
  );

  router.post(
    '/verify-email',
    originValidator,
    preAuthCsrfMiddleware,
    verifyRateLimiter,
    verifyEmailHandler(options.dbPool, options.authService)
  );

  router.post(
    '/resend-verification',
    originValidator,
    preAuthCsrfMiddleware,
    resendRateLimiter,
    resendVerificationHandler(options.dbPool, options.emailService, options.corsOrigin, options.authService)
  );

  router.post(
    '/login',
    originValidator,
    preAuthCsrfMiddleware,
    loginRateLimiter,
    loginHandler(options.dbPool, options.authService, options.csrfSecret, options.isProduction ?? false)
  );

  router.get(
    '/session',
    sessionHandler(options.dbPool, options.authService, options.csrfSecret, options.isProduction ?? false)
  );

  router.post(
    '/logout',
    originValidator,
    preAuthCsrfMiddleware,
    logoutHandler(options.dbPool, options.authService, options.isProduction ?? false)
  );

  return router;
}
