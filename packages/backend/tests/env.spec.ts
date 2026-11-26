import { describe, it, expect } from 'vitest';
import { parseEnv } from '../src/config/env.config.js';

describe('Backend Environment Configuration (Gate A1)', () => {
  const validBaseEnv: Record<string, string> = {
    NODE_ENV: 'test',
    PORT: '4000',
    CORS_ORIGIN: 'http://localhost:3000',
    LOG_LEVEL: 'info',
    BFF_SHARED_SECRET: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', // 64 chars
    SMTP_USER: 'test-mailer@paruluniversity.ac.in',
    SMTP_PASSWORD: 'dummy_test_smtp_password'
  };

  it('validates a conformant environment configuration', () => {
    const parsed = parseEnv(validBaseEnv);
    expect(parsed.PORT).toBe(4000);
    expect(parsed.NODE_ENV).toBe('test');
    expect(parsed.TRUST_PROXY ?? 'false').toBe('false');
    expect(parsed.BFF_SHARED_SECRET).toBe(validBaseEnv.BFF_SHARED_SECRET);
    expect(parsed.SMTP_USER).toBe('test-mailer@paruluniversity.ac.in');
  });

  it('rejects an environment with missing BFF_SHARED_SECRET', () => {
    const invalidEnv = { ...validBaseEnv };
    delete invalidEnv.BFF_SHARED_SECRET;
    expect(() => parseEnv(invalidEnv)).toThrow('BFF_SHARED_SECRET');
  });

  it('rejects BFF_SHARED_SECRET with fewer than 64 characters', () => {
    const shortSecretEnv = {
      ...validBaseEnv,
      BFF_SHARED_SECRET: 'too-short-secret'
    };
    expect(() => parseEnv(shortSecretEnv)).toThrow('at least 64 characters');
  });

  it('rejects production environment when DB_SSL is false', () => {
    const prodWithoutSsl = {
      ...validBaseEnv,
      NODE_ENV: 'production',
      DB_SSL: 'false'
    };
    expect(() => parseEnv(prodWithoutSsl)).toThrow('DB_SSL must be enabled');
  });

  it('rejects production environment when DB_SSL_CA_PATH file does not exist', () => {
    const prodWithoutCa = {
      ...validBaseEnv,
      NODE_ENV: 'production',
      DB_SSL: 'true',
      DB_SSL_CA_PATH: '/non/existent/path/ca.crt'
    };
    expect(() => parseEnv(prodWithoutCa)).toThrow('DB_SSL_CA_PATH file does not exist');
  });

  it('rejects production environment when TRUST_PROXY is set to blind "true"', () => {
    const prodBlindTrust = {
      ...validBaseEnv,
      NODE_ENV: 'production',
      DB_SSL: 'true',
      DB_SSL_CA_PATH: 'package.json', // Existing file for test
      TRUST_PROXY: 'true'
    };
    expect(() => parseEnv(prodBlindTrust)).toThrow('TRUST_PROXY must not be set to blind "true"');
  });

  it('accepts explicit trusted proxy configuration in production', () => {
    const prodExplicitProxy = {
      ...validBaseEnv,
      NODE_ENV: 'production',
      DB_SSL: 'true',
      DB_SSL_CA_PATH: 'package.json',
      TRUST_PROXY: 'loopback, 10.0.0.0/8'
    };
    const parsed = parseEnv(prodExplicitProxy);
    expect(parsed.TRUST_PROXY).toBe('loopback, 10.0.0.0/8');
  });
});
