import { describe, it, expect } from 'vitest';
import { createLogger, REDACTED_PATHS } from '../src/config/logger.config.js';
import { Writable } from 'node:stream';

describe('Pino Structured Logging Redaction (Gate A1)', () => {
  it('defines sensitive paths to redact', () => {
    expect(REDACTED_PATHS).toContain('password');
    expect(REDACTED_PATHS).toContain('hmacSecret');
    expect(REDACTED_PATHS).toContain('*.password');
    expect(REDACTED_PATHS).toContain('*.hmacSecret');
    expect(REDACTED_PATHS).toContain('req.headers["x-bff-signature"]');
    expect(REDACTED_PATHS).toContain('req.headers["x-csrf-token"]');
    expect(REDACTED_PATHS).toContain('req.headers.cookie');
    expect(REDACTED_PATHS).toContain('req.headers.authorization');
    expect(REDACTED_PATHS).toContain('sqlParams');
  });

  it('redacts sensitive credentials in logged objects', () => {
    const chunks: string[] = [];
    const destination = new Writable({
      write(chunk, _encoding, callback) {
        chunks.push(chunk.toString());
        callback();
      }
    });

    const testLogger = createLogger({
      level: 'info'
    }, destination);

    testLogger.info({
      event: 'user_login',
      userId: 'd1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
      password: 'SuperSecretPassword123!',
      token: 'sensitive-bearer-token',
      hmacSecret: 'raw-secret-bytes',
      nested: {
        password: 'NestedPassword456!'
      }
    });

    const loggedOutput = chunks.join('');
    expect(loggedOutput.length).toBeGreaterThan(0);
    const parsed = JSON.parse(loggedOutput.trim());

    expect(parsed.event).toBe('user_login');
    expect(parsed.userId).toBe('d1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d');
    expect(parsed.password).toBe('[REDACTED]');
    expect(parsed.token).toBe('[REDACTED]');
    expect(parsed.hmacSecret).toBe('[REDACTED]');
    expect(parsed.nested.password).toBe('[REDACTED]');
  });
});
