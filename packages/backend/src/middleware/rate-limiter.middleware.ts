import { Request, Response, NextFunction } from 'express';
import { AppError } from './error-handler.middleware.js';

/**
 * ARCHITECTURAL NOTICE — Process-Local Limitation:
 * The In-Memory Rate Limiter maintains request count state in a process-local JavaScript Map.
 *
 * PRODUCTION LIMITATION:
 * When scaling the backend horizontally across multiple Node.js processes, containers,
 * or cluster instances, this in-memory store is process-local and will NOT share rate limit
 * counters across instances. In a multi-instance production cluster, rate limits must be
 * backed by a distributed store (such as Redis or Memcached).
 *
 * For single-instance deployments and local development, this in-memory implementation
 * provides deterministic, zero-dependency protection against IP-based brute-force attacks.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export interface RateLimiterOptions {
  windowMs: number;
  maxRequests: number;
  message?: string;
  code?: string;
}

export interface RateLimiterInstance {
  (req: Request, res: Response, next: NextFunction): void;
  reset(): void;
  close(): void;
}

export function createRateLimiter(options: RateLimiterOptions): RateLimiterInstance {
  const store = new Map<string, RateLimitEntry>();
  const windowMs = options.windowMs;
  const maxRequests = options.maxRequests;
  const message = options.message ?? 'Too many requests. Please try again later.';
  const code = options.code ?? 'RATE_LIMIT_EXCEEDED';

  // Periodic cleanup interval to prevent unbounded memory growth from stale IPs
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      if (entry.resetAt <= now) {
        store.delete(key);
      }
    }
  }, Math.min(windowMs, 60000));

  if (cleanupInterval.unref) {
    cleanupInterval.unref();
  }

  const middleware = (req: Request, res: Response, next: NextFunction): void => {
    // Resolve client IP: Express trust proxy settings govern whether req.ip inspects X-Forwarded-For
    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const now = Date.now();

    let entry = store.get(ip);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 1, resetAt: now + windowMs };
      store.set(ip, entry);
    } else {
      // Synchronous count increment within Node.js event loop ensures race-free accounting
      entry.count = Math.min(entry.count + 1, maxRequests + 1000);
    }

    const remaining = Math.max(0, maxRequests - entry.count);
    const retryAfterSeconds = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));

    res.setHeader('X-RateLimit-Limit', maxRequests.toString());
    res.setHeader('X-RateLimit-Remaining', remaining.toString());
    res.setHeader('X-RateLimit-Reset', Math.ceil(entry.resetAt / 1000).toString());

    if (entry.count > maxRequests) {
      res.setHeader('Retry-After', retryAfterSeconds.toString());
      return next(new AppError({
        statusCode: 429,
        code,
        title: 'Too Many Requests',
        detail: message
      }));
    }

    next();
  };

  middleware.reset = () => {
    store.clear();
  };

  middleware.close = () => {
    clearInterval(cleanupInterval);
    store.clear();
  };

  return middleware;
}
