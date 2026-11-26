import crypto from 'node:crypto';
import {
  buildCanonicalAssertionString,
  signCanonicalAssertion,
  computeSha256,
  OperationScope,
  ProblemDetails
} from '@ipr/shared';
import { ISessionProvider, BffSession } from '../session/session.interface';
import { validateCsrfForRequest } from '../csrf/csrf-service';

export interface BffForwarderConfig {
  readonly backendOrigin: string;
  readonly sharedSecretHex: string;
  readonly csrfSecret: string;
  readonly sessionProvider: ISessionProvider;
}

interface RouteWhitelistRule {
  readonly regex: RegExp;
  readonly method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  readonly scope: OperationScope;
  readonly mapToBackendPath: (match: RegExpMatchArray) => string;
}

/**
 * Whitelist of permitted BFF routes.
 * Strictly prevents open-proxy behavior and arbitrary backend URL forwarding.
 */
const BFF_ROUTE_WHITELIST: readonly RouteWhitelistRule[] = [
  {
    regex: /^\/disclosures$/,
    method: 'GET',
    scope: 'OP_VIEW_DISCLOSURE',
    mapToBackendPath: () => '/api/v1/disclosures'
  },
  {
    regex: /^\/disclosures\/([a-zA-Z0-9-]+)\/consents$/,
    method: 'GET',
    scope: 'OP_VIEW_DISCLOSURE',
    mapToBackendPath: (m) => `/api/v1/disclosures/${m[1]}/consents`
  },
  {
    regex: /^\/disclosures\/([a-zA-Z0-9-]+)\/attachments$/,
    method: 'GET',
    scope: 'OP_VIEW_DISCLOSURE',
    mapToBackendPath: (m) => `/api/v1/disclosures/${m[1]}/attachments`
  },
  {
    regex: /^\/drafts\/([a-zA-Z0-9-]+)\/submit$/,
    method: 'POST',
    scope: 'OP_SUBMIT_DISCLOSURE',
    mapToBackendPath: (m) => `/api/v1/drafts/${m[1]}/submit`
  },
  {
    regex: /^\/disclosures\/([a-zA-Z0-9-]+)$/,
    method: 'GET',
    scope: 'OP_VIEW_DISCLOSURE',
    mapToBackendPath: (m) => `/api/v1/disclosures/${m[1]}`
  },
  {
    regex: /^\/drafts$/,
    method: 'POST',
    scope: 'OP_CREATE_DRAFT',
    mapToBackendPath: () => '/api/v1/drafts'
  },
  {
    regex: /^\/drafts\/([a-zA-Z0-9-]+)$/,
    method: 'PUT',
    scope: 'OP_UPDATE_DRAFT',
    mapToBackendPath: (m) => `/api/v1/drafts/${m[1]}`
  },
  {
    regex: /^\/drafts\/([a-zA-Z0-9-]+)$/,
    method: 'PATCH',
    scope: 'OP_UPDATE_DRAFT',
    mapToBackendPath: (m) => `/api/v1/drafts/${m[1]}`
  },
  {
    regex: /^\/attachments$/,
    method: 'POST',
    scope: 'OP_UPLOAD_ATTACHMENT',
    mapToBackendPath: () => '/api/v1/attachments'
  },
  {
    regex: /^\/consent\/request$/,
    method: 'POST',
    scope: 'OP_CREATE_CONSENT',
    mapToBackendPath: () => '/api/v1/consent/request'
  },
  {
    regex: /^\/consent\/verify$/,
    method: 'POST',
    scope: 'OP_VERIFY_CONSENT',
    mapToBackendPath: () => '/api/v1/consent/verify'
  },
  {
    regex: /^\/consent\/revoke$/,
    method: 'POST',
    scope: 'OP_REVOKE_CONSENT',
    mapToBackendPath: () => '/api/v1/consent/revoke'
  },
  {
    regex: /^\/disclosures\/([a-zA-Z0-9-]+)\/assign-reviewer$/,
    method: 'POST',
    scope: 'OP_ASSIGN_REVIEWER',
    mapToBackendPath: (m) => `/api/v1/disclosures/${m[1]}/assign-reviewer`
  },
  {
    regex: /^\/disclosures\/([a-zA-Z0-9-]+)\/evaluate$/,
    method: 'POST',
    scope: 'OP_REVIEW_EVALUATION',
    mapToBackendPath: (m) => `/api/v1/disclosures/${m[1]}/evaluate`
  },
  {
    regex: /^\/disclosures\/([a-zA-Z0-9-]+)\/legal-clearance$/,
    method: 'POST',
    scope: 'OP_LEGAL_CLEARANCE',
    mapToBackendPath: (m) => `/api/v1/disclosures/${m[1]}/legal-clearance`
  },
  {
    regex: /^\/patents$/,
    method: 'POST',
    scope: 'OP_CREATE_PATENT_APPLICATION',
    mapToBackendPath: () => '/api/v1/patents'
  },
  {
    regex: /^\/patents\/([a-zA-Z0-9-]+)\/assign-legal$/,
    method: 'POST',
    scope: 'OP_ASSIGN_LEGAL_OFFICER',
    mapToBackendPath: (m) => `/api/v1/patents/${m[1]}/assign-legal`
  },
  {
    regex: /^\/patents\/([a-zA-Z0-9-]+)\/stage-transition$/,
    method: 'POST',
    scope: 'OP_TRANSITION_PATENT_STAGE',
    mapToBackendPath: (m) => `/api/v1/patents/${m[1]}/stage-transition`
  }
];

function createProblemResponse(
  status: number,
  code: string,
  title: string,
  detail: string,
  instance: string
): Response {
  const problem: ProblemDetails = {
    type: `https://ipr.paruluniversity.ac.in/errors/${code}`,
    title,
    status,
    detail,
    instance: instance.split('?')[0] || '/',
    code
  };
  return new Response(JSON.stringify(problem), {
    status,
    headers: {
      'Content-Type': 'application/problem+json'
    }
  });
}

export class BffForwarder {
  constructor(private readonly config: BffForwarderConfig) {}

  public async forwardRequest(request: Request, subpath: string): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method.toUpperCase() as 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

    // 1. Path traversal & sanitization check
    if (subpath.includes('..') || subpath.includes('\0') || subpath.includes('//')) {
      return createProblemResponse(
        400,
        'BFF_INVALID_PATH',
        'Invalid Path Traversal',
        'Requested path contains prohibited characters or traversal sequences.',
        url.pathname
      );
    }

    const normalizedSubpath = subpath.startsWith('/') ? subpath : `/${subpath}`;

    // 2. Route Whitelist Matching (Anti-Open Proxy)
    let matchedRule: RouteWhitelistRule | null = null;
    let matchResult: RegExpMatchArray | null = null;

    for (const rule of BFF_ROUTE_WHITELIST) {
      if (rule.method === method) {
        const match = normalizedSubpath.match(rule.regex);
        if (match) {
          matchedRule = rule;
          matchResult = match;
          break;
        }
      }
    }

    if (!matchedRule || !matchResult) {
      return createProblemResponse(
        404,
        'BFF_ROUTE_UNAUTHORIZED',
        'Route Not Permitted',
        `No authorized backend route mapping exists for ${method} ${normalizedSubpath}`,
        url.pathname
      );
    }

    // 3. Authenticate Session via Server-Side ISessionProvider
    let session: BffSession | null = null;
    try {
      session = await this.config.sessionProvider.getSession(request);
    } catch {
      return createProblemResponse(
        500,
        'BFF_SESSION_ERROR',
        'Session Resolution Error',
        'An error occurred while resolving server session.',
        url.pathname
      );
    }

    if (!session) {
      return createProblemResponse(
        401,
        'UNAUTHENTICATED',
        'Authentication Required',
        'No valid active session found. Please log in.',
        url.pathname
      );
    }

    // 4. CSRF Protection for state-changing requests
    const csrfCheck = validateCsrfForRequest(request, session, this.config.csrfSecret);
    if (!csrfCheck.valid) {
      return createProblemResponse(
        403,
        'CSRF_TOKEN_INVALID',
        'CSRF Validation Failed',
        csrfCheck.reason || 'CSRF validation failed for state-changing request.',
        url.pathname
      );
    }

    // 5. Read body bytes and enforce maximum payload size (1MB)
    let bodyBytes = Buffer.alloc(0);
    if (['POST', 'PUT', 'PATCH'].includes(method)) {
      const arrayBuf = await request.arrayBuffer();
      bodyBytes = Buffer.from(arrayBuf);
      if (bodyBytes.length > 1048576) {
        return createProblemResponse(
          413,
          'PAYLOAD_TOO_LARGE',
          'Payload Exceeds Limit',
          'Request payload exceeds the maximum 1MB boundary limit.',
          url.pathname
        );
      }
    }

    const targetBackendPath = matchedRule.mapToBackendPath(matchResult);
    const bodyHash = computeSha256(bodyBytes);
    const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    const nonce = crypto.randomBytes(16).toString('hex');
    const queryString = url.search.startsWith('?') ? url.search.slice(1) : url.search;

    // 6. Build 9-element canonical request string
    const canonicalString = buildCanonicalAssertionString({
      method,
      canonicalPath: targetBackendPath,
      queryParams: queryString,
      operationScope: matchedRule.scope,
      actorId: session.actorId,
      roles: session.roles,
      timestamp,
      nonce,
      bodyHash
    });

    // 7. Cryptographically sign canonical assertion using server-only secret
    const signature = signCanonicalAssertion(canonicalString, this.config.sharedSecretHex);

    // 8. Prepare forwarding headers (stripping browser-supplied internal assertions)
    const backendHeaders: Record<string, string> = {
      'Content-Type': request.headers.get('content-type') || 'application/json',
      'X-Request-ID': request.headers.get('x-request-id') || crypto.randomUUID(),
      // Injected server assertions:
      'X-BFF-Signature': signature,
      'X-BFF-Actor-ID': session.actorId,
      'X-BFF-Roles': session.roles.join(','),
      'X-BFF-Timestamp': timestamp,
      'X-BFF-Nonce': nonce,
      'X-BFF-Operation-Scope': matchedRule.scope,
      'X-BFF-Body-Hash': bodyHash
    };

    // 9. Dispatch to backend origin
    const backendUrl = `${this.config.backendOrigin}${targetBackendPath}${url.search}`;

    try {
      const backendRes = await fetch(backendUrl, {
        method,
        headers: backendHeaders,
        body: ['POST', 'PUT', 'PATCH'].includes(method) ? bodyBytes : undefined
      });

      const responseBody = await backendRes.arrayBuffer();
      const clientResponseHeaders = new Headers();

      backendRes.headers.forEach((val, key) => {
        // Strip sensitive internal backend transport headers before replying to client
        if (!key.toLowerCase().startsWith('x-bff-')) {
          clientResponseHeaders.set(key, val);
        }
      });

      return new Response(responseBody, {
        status: backendRes.status,
        headers: clientResponseHeaders
      });
    } catch {
      return createProblemResponse(
        502,
        'BAD_GATEWAY',
        'Backend Service Unavailable',
        'Failed to connect to the backend API service.',
        url.pathname
      );
    }
  }
}
