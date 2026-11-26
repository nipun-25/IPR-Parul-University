import { Request, Response, NextFunction } from 'express';
import {
  INonceStore,
  buildCanonicalAssertionString,
  verifyCanonicalAssertion,
  computeSha256,
  canonicalizePath,
  canonicalizeQuery,
  validateScopeAuthorization,
  isOperationScope
} from '@ipr/shared';
import { AppError } from './error-handler.middleware.js';

export interface AuthenticatedActorContext {
  readonly actorId: string;
  readonly roles: readonly string[];
  readonly operationScope: string;
  readonly timestamp: string;
  readonly nonce: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      actor?: AuthenticatedActorContext;
      rawBody?: Buffer;
    }
  }
}

export interface BffAssertionMiddlewareOptions {
  readonly sharedSecretHex: string;
  readonly nonceStore: INonceStore;
  readonly allowedClockSkewSeconds?: number;
}

export function createBffAssertionMiddleware(options: BffAssertionMiddlewareOptions) {
  const { sharedSecretHex, nonceStore, allowedClockSkewSeconds = 300 } = options;

  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      // 1. Extract internal BFF security headers
      const signature = req.headers['x-bff-signature'];
      const actorId = req.headers['x-bff-actor-id'];
      const rolesHeader = req.headers['x-bff-roles'];
      const timestamp = req.headers['x-bff-timestamp'];
      const nonce = req.headers['x-bff-nonce'];
      const scope = req.headers['x-bff-operation-scope'];

      if (
        typeof signature !== 'string' ||
        typeof actorId !== 'string' ||
        typeof rolesHeader !== 'string' ||
        typeof timestamp !== 'string' ||
        typeof nonce !== 'string' ||
        typeof scope !== 'string'
      ) {
        throw new AppError({
          statusCode: 401,
          code: 'BFF_ASSERTION_MISSING_HEADERS',
          title: 'Missing BFF Assertion Headers',
          detail: 'One or more mandatory BFF security assertion headers are missing or malformed.'
        });
      }

      // 2. Validate strictly formatted ISO-8601 UTC timestamp
      const strictUtcIsoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
      if (!strictUtcIsoRegex.test(timestamp)) {
        throw new AppError({
          statusCode: 400,
          code: 'BFF_ASSERTION_MALFORMED_TIMESTAMP',
          title: 'Malformed Timestamp',
          detail: 'BFF timestamp must strictly conform to UTC ISO-8601 format (YYYY-MM-DDTHH:MM:SSZ).'
        });
      }

      const assertionDate = new Date(timestamp);
      const now = Date.now();
      const skewMs = allowedClockSkewSeconds * 1000;

      if (Math.abs(now - assertionDate.getTime()) > skewMs) {
        throw new AppError({
          statusCode: 401,
          code: 'BFF_ASSERTION_TIMESTAMP_EXPIRED',
          title: 'Assertion Expired',
          detail: 'BFF assertion timestamp is outside the permitted clock-skew validity window.'
        });
      }

      // 3. Parse and validate actor roles
      const parsedRoles = rolesHeader.split(',').map((r) => r.trim()).filter(Boolean);
      if (parsedRoles.length === 0) {
        throw new AppError({
          statusCode: 401,
          code: 'BFF_ASSERTION_EMPTY_ROLES',
          title: 'Invalid Roles Assertion',
          detail: 'BFF assertion must supply at least one valid actor role.'
        });
      }

      // 4. Validate operation scope against registry, HTTP method, and actor roles
      if (!isOperationScope(scope)) {
        throw new AppError({
          statusCode: 403,
          code: 'BFF_OPERATION_SCOPE_UNKNOWN',
          title: 'Unknown Operation Scope',
          detail: `Asserted operation scope '${scope}' is not recognized in the scope registry.`
        });
      }

      const scopeValidation = validateScopeAuthorization(scope, req.method, parsedRoles);
      if (!scopeValidation.valid) {
        throw new AppError({
          statusCode: 403,
          code: 'BFF_SCOPE_AUTHORIZATION_DENIED',
          title: 'Operation Scope Authorization Denied',
          detail: scopeValidation.reason || 'Actor lacks authorization for the requested operation scope.'
        });
      }

      // 5. Recompute SHA-256 over exact request body bytes
      let bodyHash: string;
      if (req.rawBody && req.rawBody.length > 0) {
        bodyHash = computeSha256(req.rawBody);
      } else if (req.body && Object.keys(req.body).length > 0) {
        bodyHash = computeSha256(JSON.stringify(req.body));
      } else {
        bodyHash = computeSha256('');
      }

      // Optional check if incoming X-BFF-Body-Hash was supplied and matches
      const incomingBodyHash = req.headers['x-bff-body-hash'];
      if (typeof incomingBodyHash === 'string' && incomingBodyHash.toLowerCase() !== bodyHash) {
        throw new AppError({
          statusCode: 400,
          code: 'BFF_BODY_HASH_MISMATCH',
          title: 'Body Hash Mismatch',
          detail: 'Asserted body hash does not match computed request payload hash.'
        });
      }

      // 6. Build the 9-element canonical assertion string (using full request path including mount prefixes)
      const fullPath = (req.originalUrl || req.url || req.path).split('?')[0];
      const canonicalPath = canonicalizePath(fullPath);
      const canonicalQuery = canonicalizeQuery(req.query as Record<string, string | string[]>);

      let canonicalAssertion: string;
      try {
        canonicalAssertion = buildCanonicalAssertionString({
          method: req.method,
          canonicalPath,
          queryParams: canonicalQuery,
          operationScope: scope,
          actorId,
          roles: parsedRoles,
          timestamp,
          nonce,
          bodyHash
        });
      } catch (err) {
        throw new AppError({
          statusCode: 400,
          code: 'BFF_CANONICALIZATION_FAILED',
          title: 'Canonicalization Failed',
          detail: err instanceof Error ? err.message : 'Failed to canonicalize request assertion.'
        });
      }

      // 7. Verify HMAC-SHA256 signature using constant-time comparison
      const isSignatureValid = verifyCanonicalAssertion(
        canonicalAssertion,
        signature,
        sharedSecretHex
      );

      if (!isSignatureValid) {
        throw new AppError({
          statusCode: 401,
          code: 'BFF_SIGNATURE_INVALID',
          title: 'Invalid BFF Signature',
          detail: 'Cryptographic signature verification failed for this request.'
        });
      }

      // 8. Atomically consume the nonce through the injected NonceStore (Replay Protection)
      const nonceResult = await nonceStore.consumeNonce(
        nonce,
        assertionDate,
        allowedClockSkewSeconds
      );

      if (nonceResult.status === 'STORE_FAILURE') {
        // Fail closed when storage is unavailable
        throw new AppError({
          statusCode: 503,
          code: 'NONCE_STORE_UNAVAILABLE',
          title: 'Service Temporarily Unavailable',
          detail: 'Replay protection store is currently unavailable; request failed closed.'
        });
      }

      if (nonceResult.status === 'REPLAY_DETECTED') {
        throw new AppError({
          statusCode: 409,
          code: 'ASSERTION_REPLAY_DETECTED',
          title: 'Replay Attack Detected',
          detail: 'A request with this nonce has already been processed or expired.'
        });
      }

      // 9. Attach trusted actor context for downstream handlers
      req.actor = {
        actorId,
        roles: parsedRoles,
        operationScope: scope,
        timestamp,
        nonce
      };

      return next();
    } catch (err) {
      return next(err);
    }
  };
}
