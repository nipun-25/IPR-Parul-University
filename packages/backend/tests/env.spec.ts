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

  const validProdCsrf = 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210';
  const validProdScannerPw = 'dedicated_scanner_production_secret_pw';

  it('defaults SCANNER_DB_USER to ipr_scanner', () => {
    const parsed = parseEnv(validBaseEnv);
    expect(parsed.SCANNER_DB_USER).toBe('ipr_scanner');
    expect(parsed.SCANNER_DB_PASSWORD).toBeUndefined();
  });

  it('rejects production environment when DB_SSL is false', () => {
    const prodWithoutSsl = {
      ...validBaseEnv,
      NODE_ENV: 'production',
      DB_SSL: 'false',
      CSRF_SECRET: validProdCsrf,
      SCANNER_DB_PASSWORD: validProdScannerPw
    };
    expect(() => parseEnv(prodWithoutSsl)).toThrow('DB_SSL must be enabled');
  });

  it('rejects production environment when DB_SSL_CA_PATH file does not exist', () => {
    const prodWithoutCa = {
      ...validBaseEnv,
      NODE_ENV: 'production',
      DB_SSL: 'true',
      DB_SSL_CA_PATH: '/non/existent/path/ca.crt',
      CSRF_SECRET: validProdCsrf,
      SCANNER_DB_PASSWORD: validProdScannerPw
    };
    expect(() => parseEnv(prodWithoutCa)).toThrow('DB_SSL_CA_PATH file does not exist');
  });

  it('rejects production environment when TRUST_PROXY is set to blind "true"', () => {
    const prodBlindTrust = {
      ...validBaseEnv,
      NODE_ENV: 'production',
      DB_SSL: 'true',
      DB_SSL_CA_PATH: 'package.json', // Existing file for test
      TRUST_PROXY: 'true',
      CSRF_SECRET: validProdCsrf,
      SCANNER_DB_PASSWORD: validProdScannerPw
    };
    expect(() => parseEnv(prodBlindTrust)).toThrow('TRUST_PROXY must not be set to blind "true"');
  });

  it('accepts explicit trusted proxy configuration in production', () => {
    const prodExplicitProxy = {
      ...validBaseEnv,
      NODE_ENV: 'production',
      DB_SSL: 'true',
      DB_SSL_CA_PATH: 'package.json',
      TRUST_PROXY: 'loopback, 10.0.0.0/8',
      CSRF_SECRET: validProdCsrf,
      SCANNER_DB_PASSWORD: validProdScannerPw
    };
    const parsed = parseEnv(prodExplicitProxy);
    expect(parsed.TRUST_PROXY).toBe('loopback, 10.0.0.0/8');
  });

  it('rejects production environment when CSRF_SECRET is missing', () => {
    const prodWithoutCsrf = {
      ...validBaseEnv,
      NODE_ENV: 'production',
      DB_SSL: 'true',
      DB_SSL_CA_PATH: 'package.json',
      SCANNER_DB_PASSWORD: validProdScannerPw
    };
    expect(() => parseEnv(prodWithoutCsrf)).toThrow('In production, a dedicated CSRF_SECRET must be provided.');
  });

  it('rejects production environment when CSRF_SECRET is fewer than 32 characters', () => {
    const prodWeakCsrf = {
      ...validBaseEnv,
      NODE_ENV: 'production',
      DB_SSL: 'true',
      DB_SSL_CA_PATH: 'package.json',
      CSRF_SECRET: 'short-secret',
      SCANNER_DB_PASSWORD: validProdScannerPw
    };
    expect(() => parseEnv(prodWeakCsrf)).toThrow('at least 32 characters');
  });

  it('rejects production environment when CSRF_SECRET reuses BFF_SHARED_SECRET', () => {
    const prodReusedSecret = {
      ...validBaseEnv,
      NODE_ENV: 'production',
      DB_SSL: 'true',
      DB_SSL_CA_PATH: 'package.json',
      CSRF_SECRET: validBaseEnv.BFF_SHARED_SECRET,
      SCANNER_DB_PASSWORD: validProdScannerPw
    };
    expect(() => parseEnv(prodReusedSecret)).toThrow('secret separation required');
  });

  it('rejects production environment when SCANNER_DB_PASSWORD is missing', () => {
    const prodWithoutScannerPw = {
      ...validBaseEnv,
      NODE_ENV: 'production',
      DB_SSL: 'true',
      DB_SSL_CA_PATH: 'package.json',
      CSRF_SECRET: validProdCsrf
    };
    expect(() => parseEnv(prodWithoutScannerPw)).toThrow('In production, SCANNER_DB_PASSWORD must be provided');
  });

  it('rejects environment when SCANNER_DB_PASSWORD reuses DB_PASSWORD', () => {
    const reusedScannerPw = {
      ...validBaseEnv,
      DB_PASSWORD: 'app_database_password_123',
      SCANNER_DB_PASSWORD: 'app_database_password_123'
    };
    expect(() => parseEnv(reusedScannerPw)).toThrow('SCANNER_DB_PASSWORD must not reuse DB_PASSWORD');
  });

  it('accepts production environment with a strong, dedicated CSRF_SECRET and distinct SCANNER_DB_PASSWORD', () => {
    const prodValidEnv = {
      ...validBaseEnv,
      NODE_ENV: 'production',
      DB_SSL: 'true',
      DB_SSL_CA_PATH: 'package.json',
      CSRF_SECRET: validProdCsrf,
      SCANNER_DB_PASSWORD: validProdScannerPw
    };
    const parsed = parseEnv(prodValidEnv);
    expect(parsed.CSRF_SECRET).toBe(validProdCsrf);
    expect(parsed.SCANNER_DB_PASSWORD).toBe(validProdScannerPw);
    expect(parsed.SCANNER_DB_USER).toBe('ipr_scanner');
  });
});
