import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import type { Pool } from 'pg';
import {
  INonceStore,
  InMemoryNonceStore,
  IResourceAuthorizationProvider
} from '@ipr/shared';
import { requestIdMiddleware } from './middleware/request-id.middleware.js';
import { globalErrorHandler, AppError } from './middleware/error-handler.middleware.js';
import { createBffAssertionMiddleware } from './middleware/bff-assertion.middleware.js';
import { createDraftHandler, updateDraftHandler, submitDraftHandler } from './controllers/draft.controller.js';
import { getDisclosureHandler } from './controllers/disclosure.controller.js';
import { BackendEnv } from './config/env.config.js';

export interface CreateAppOptions {
  readonly nonceStore?: INonceStore;
  readonly allowedClockSkewSeconds?: number;
  readonly resourceAuthProvider?: IResourceAuthorizationProvider;
  readonly dbPool?: Pool;
}

export function createApp(env: BackendEnv, options?: CreateAppOptions): Express {
  const app: Express = express();
  const nonceStore = options?.nonceStore ?? new InMemoryNonceStore();

  // Standard Security Headers
  app.use(helmet({
    contentSecurityPolicy: true,
    crossOriginEmbedderPolicy: true
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

  // View Disclosure (Gate P2 Stage 2C)
  protectedApiRouter.get('/disclosures/:id', getDisclosureHandler(options?.dbPool));

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
