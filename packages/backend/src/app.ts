import crypto from 'node:crypto';
import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import type { Pool } from 'pg';
import {
  INonceStore,
  InMemoryNonceStore,
  IResourceAuthorizationProvider,
  IQuarantineStorageAdapter,
  InMemoryQuarantineStorage
} from '@ipr/shared';
import { requestIdMiddleware } from './middleware/request-id.middleware.js';
import { globalErrorHandler, AppError } from './middleware/error-handler.middleware.js';
import { createBffAssertionMiddleware } from './middleware/bff-assertion.middleware.js';
import { createDraftHandler, updateDraftHandler, submitDraftHandler } from './controllers/draft.controller.js';
import {
  getDisclosureHandler,
  listDisclosuresHandler,
  getDisclosureConsentsHandler,
  getDisclosureAttachmentsHandler,
  createAttachmentHandler,
  createConsentRequestHandler,
  revokeConsentHandler,
  cancelConsentInvitationHandler
} from './controllers/disclosure.controller.js';
import {
  uploadAttachmentContentHandler,
  abandonAttachmentHandler
} from './controllers/attachment-upload.controller.js';
import { AntivirusScannerService } from './services/scanner.service.js';
import { createAuthRouter } from './routes/auth.routes.js';
import { EmailService } from './services/email.service.js';
import { AuthService } from './services/auth.service.js';
import { BackendEnv } from './config/env.config.js';
import { parseTrustProxy } from './utils/proxy.util.js';

export interface CreateAppOptions {
  readonly nonceStore?: INonceStore;
  readonly allowedClockSkewSeconds?: number;
  readonly resourceAuthProvider?: IResourceAuthorizationProvider;
  readonly dbPool?: Pool;
  readonly emailService?: EmailService;
  readonly authService?: AuthService;
  readonly quarantineStorage?: IQuarantineStorageAdapter;
  readonly scannerPool?: Pool;
  readonly scannerService?: AntivirusScannerService;
  readonly registerRateLimitMax?: number;
  readonly verifyRateLimitMax?: number;
  readonly resendRateLimitMax?: number;
  readonly loginRateLimitMax?: number;
  readonly csrfRateLimitMax?: number;
  readonly csrfSecret?: string;
  readonly trustProxy?: boolean | string | number | string[];
}

export function createApp(env: BackendEnv, options?: CreateAppOptions): Express {
  const app: Express = express();
  const nonceStore = options?.nonceStore ?? new InMemoryNonceStore();

  // Configure Express Trust Proxy
  // Controls whether Express trusts X-Forwarded-* headers when resolving req.ip.
  // When false (default), req.ip is the direct socket remote address, preventing header spoofing.
  // When configured with trusted IPs/subnets, X-Forwarded-For is trusted ONLY when the immediate
  // connection arrives from a trusted proxy.
  const trustProxySetting = options?.trustProxy !== undefined
    ? parseTrustProxy(options.trustProxy)
    : parseTrustProxy(env.TRUST_PROXY);
  app.set('trust proxy', trustProxySetting);

  // Standard Security Headers
  app.use(helmet({
    contentSecurityPolicy: true,
    crossOriginEmbedderPolicy: true,
    referrerPolicy: { policy: 'no-referrer' }
  }));

  // CORS Policy
  app.use(cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-CSRF-Token',
      'X-Request-ID',
      'X-BFF-Signature',
      'X-BFF-Actor-ID',
      'X-BFF-Roles',
      'X-BFF-Timestamp',
      'X-BFF-Nonce',
      'X-BFF-Operation-Scope',
      'X-BFF-Body-Hash'
    ]
  }));

  // Raw stream body parser for binary/multipart attachment upload (up to 26MB)
  app.use('/api/v1/attachments/:id/upload', express.raw({
    type: () => true,
    limit: '26mb',
    verify: (req: Request, _res: Response, buf: Buffer) => {
      req.rawBody = buf;
    }
  }));

  // Body Parser with strict limit and raw body preservation for exact HMAC verification
  app.use(express.json({
    limit: '1mb',
    verify: (req: Request, _res: Response, buf: Buffer) => {
      req.rawBody = buf;
    }
  }));

  // Request ID and Timing Injection
  app.use(requestIdMiddleware);

  // Intentionally Public Health Check Endpoint (Gate A1 / P2.1)
  app.get('/health', async (_req: Request, res: Response) => {
    let dbStatus: 'connected' | 'disconnected' | 'not_configured' = 'not_configured';
    let isHealthy = true;

    if (options?.dbPool) {
      try {
        await options.dbPool.query('SELECT 1');
        dbStatus = 'connected';
      } catch {
        dbStatus = 'disconnected';
        isHealthy = false;
      }
    }

    const statusCode = isHealthy ? 200 : 503;
    res.status(statusCode).json({
      status: isHealthy ? 'healthy' : 'unhealthy',
      environment: env.NODE_ENV,
      database: dbStatus,
      timestamp: new Date().toISOString()
    });
  });

  // Diagnostic Test Error Endpoint (for Gate A1 RFC 7807 verification)
  app.get('/public/test-error', (req: Request, _res: Response, next: NextFunction) => {
    const errorType = req.query.type as string;
    if (errorType === 'sqlstate_ipr01') {
      const err = new Error('Database gateway error');
      Object.assign(err, { code: 'IPR01' });
      return next(err);
    }
    if (errorType === 'app_error') {
      return next(new AppError({
        statusCode: 422,
        code: 'VALIDATION_FAILED',
        title: 'Validation Failed',
        detail: 'The submitted entity failed business validation.'
      }));
    }
    return next(new Error('Unexpected system error'));
  });

  // Backward-compatible alias for existing test suite
  app.get('/api/v1/test-error', (req: Request, res: Response, next: NextFunction) => {
    const errorType = req.query.type as string;
    if (errorType === 'sqlstate_ipr01') {
      const err = new Error('Database gateway error');
      Object.assign(err, { code: 'IPR01' });
      return next(err);
    }
    if (errorType === 'app_error') {
      return next(new AppError({
        statusCode: 422,
        code: 'VALIDATION_FAILED',
        title: 'Validation Failed',
        detail: 'The submitted entity failed business validation.'
      }));
    }
    return next(new Error('Unexpected system error'));
  });

  // =========================================================================
  // CENTRALIZED PROTECTED ROUTER BOUNDARY
  // Every route mounted under this router is unconditionally verified by
  // the BFF assertion middleware. No individual route can accidentally omit it.
  // =========================================================================
  const protectedApiRouter = express.Router();

  // 1. Mandatory BFF Request Assertion & Operation Scope Verification
  protectedApiRouter.use(createBffAssertionMiddleware({
    sharedSecretHex: env.BFF_SHARED_SECRET,
    nonceStore,
    allowedClockSkewSeconds: options?.allowedClockSkewSeconds
  }));

  // Create Draft Disclosure (Gate P2 Stage 2B)
  protectedApiRouter.post('/drafts', createDraftHandler(options?.dbPool));

  // Update Draft Disclosure (Gate P2 Stage 2D)
  protectedApiRouter.patch('/drafts/:id', updateDraftHandler(options?.dbPool));

  // Submit Draft Disclosure (Gate P2 Stage 2E)
  protectedApiRouter.post('/drafts/:id/submit', submitDraftHandler(options?.dbPool));

  // List Disclosures (Student Dashboard - Gate P2 Stage 2G)
  protectedApiRouter.get('/disclosures', listDisclosuresHandler(options?.dbPool));

  // View Disclosure (Gate P2 Stage 2C)
  protectedApiRouter.get('/disclosures/:id', getDisclosureHandler(options?.dbPool));

  // View Disclosure Consents & Attachments List
  protectedApiRouter.get('/disclosures/:id/consents', getDisclosureConsentsHandler(options?.dbPool));
  protectedApiRouter.get('/disclosures/:id/attachments', getDisclosureAttachmentsHandler(options?.dbPool));

  // Attachments Upload Metadata
  protectedApiRouter.post('/attachments', createAttachmentHandler(options?.dbPool));

  // Attachment Binary Upload & Quarantine Scanning (Gate P2 Stage 2G.2)
  // Privilege separation: Scanner must never fall back to dbPool (ipr_app).
  // It requires either an explicitly injected scannerService or a dedicated scannerPool (ipr_scanner).
  const quarantineStorage = options?.quarantineStorage ?? new InMemoryQuarantineStorage();
  const scannerService = options?.scannerService ?? (
    options?.scannerPool
      ? new AntivirusScannerService(options.scannerPool, quarantineStorage)
      : undefined
  );
  protectedApiRouter.post(
    '/attachments/:id/upload',
    uploadAttachmentContentHandler(options?.dbPool, quarantineStorage, scannerService)
  );
  protectedApiRouter.post(
    '/attachments/:id/abandon',
    abandonAttachmentHandler(options?.dbPool, quarantineStorage)
  );

  // Consent Requests Mutation
  protectedApiRouter.post('/consent/request', createConsentRequestHandler(options?.dbPool));
  protectedApiRouter.post('/consent/revoke', revokeConsentHandler(options?.dbPool));
  protectedApiRouter.post('/consent/cancel', cancelConsentInvitationHandler(options?.dbPool));

  // Public Authentication Endpoints (Registration & Email Verification - Gate P2 Stage 2F)
  let csrfSecret: string;
  if (options?.csrfSecret) {
    csrfSecret = options.csrfSecret;
  } else if (env.CSRF_SECRET) {
    csrfSecret = env.CSRF_SECRET;
  } else if (env.NODE_ENV !== 'production') {
    // Explicit, development/test-only fallback when CSRF_SECRET is omitted in local dev
    csrfSecret = crypto.createHmac('sha256', env.BFF_SHARED_SECRET)
      .update('DEVELOPMENT_ONLY_pu_ipr_pre_auth_csrf_salt')
      .digest('hex');
  } else {
    throw new Error('FATAL: CSRF_SECRET is required in production and must not be derived from other secrets.');
  }

  const authRouter = createAuthRouter({
    dbPool: options?.dbPool,
    emailService: options?.emailService ?? (env.SMTP_USER ? new EmailService(env) : undefined),
    corsOrigin: env.CORS_ORIGIN,
    authService: options?.authService,
    registerRateLimitMax: options?.registerRateLimitMax ?? (env.NODE_ENV === 'test' ? 1000 : 5),
    verifyRateLimitMax: options?.verifyRateLimitMax ?? (env.NODE_ENV === 'test' ? 1000 : 10),
    resendRateLimitMax: options?.resendRateLimitMax ?? (env.NODE_ENV === 'test' ? 1000 : 5),
    loginRateLimitMax: options?.loginRateLimitMax ?? (env.NODE_ENV === 'test' ? 1000 : 5),
    csrfRateLimitMax: options?.csrfRateLimitMax ?? (env.NODE_ENV === 'test' ? 1000 : 30),
    csrfSecret,
    isProduction: env.NODE_ENV === 'production'
  });
  app.use('/api/v1/auth', authRouter);

  // Mount the centralized protected router under /api/v1
  app.use('/api/v1', protectedApiRouter);

  // 404 Handler (RFC 7807)
  app.use((req: Request, _res: Response, next: NextFunction) => {
    next(new AppError({
      statusCode: 404,
      code: 'ROUTE_NOT_FOUND',
      title: 'Not Found',
      detail: `Cannot ${req.method} ${req.path}`
    }));
  });

  // Global Centralized Error Handler (RFC 7807)
  app.use(globalErrorHandler);

  return app;
}
