import pino, { Logger, LoggerOptions, DestinationStream } from 'pino';

export const REDACTED_PATHS = [
  // Top-level sensitive keys
  'password',
  'hmacSecret',
  'secret',
  'token',
  'inviteToken',
  'signature',
  'sqlParams',
  // Wildcard nested keys
  '*.password',
  '*.hmacSecret',
  '*.secret',
  '*.token',
  '*.inviteToken',
  '*.signature',
  '*.sqlParams',
  // HTTP headers and request bodies
  'req.headers["x-bff-signature"]',
  'req.headers["x-csrf-token"]',
  'req.headers.cookie',
  'req.headers.authorization',
  'body.password',
  'body.token',
  'body.secret'
];

export function createLogger(options?: LoggerOptions, destination?: DestinationStream): Logger {
  const defaultOptions: LoggerOptions = {
    level: process.env.LOG_LEVEL || 'info',
    redact: {
      paths: REDACTED_PATHS,
      censor: '[REDACTED]'
    }
  };

  const mergedOptions = {
    ...defaultOptions,
    ...options,
    redact: {
      paths: REDACTED_PATHS,
      censor: '[REDACTED]',
      ...(options?.redact as Record<string, unknown> | undefined)
    }
  };

  return destination ? pino(mergedOptions, destination) : pino(mergedOptions);
}

export const logger = createLogger();
