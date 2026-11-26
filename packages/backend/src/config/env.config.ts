import { z } from 'zod';
import fs from 'node:fs';

export const BackendEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGIN: z.string().url().default('http://localhost:3000'),

  // Logging
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  // Inter-Service BFF Security
  BFF_SHARED_SECRET: z.string().min(64, 'BFF_SHARED_SECRET must be at least 64 characters long'),

  // PostgreSQL Connection & TLS configuration
  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.coerce.number().int().positive().default(5432),
  DB_NAME: z.string().default('ipr_db'),
  DB_USER: z.string().default('ipr_app'),
  DB_PASSWORD: z.string().default('placeholder_secret'),
  DB_SSL: z.enum(['true', 'false']).default('false').transform((v) => v === 'true'),
  DB_SSL_CA_PATH: z.string().optional(),

  // Email / SMTP Configuration
  SMTP_HOST: z.string().default('smtp.gmail.com'),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().email('SMTP_USER must be a valid email address'),
  SMTP_PASSWORD: z.string().min(1, 'SMTP_PASSWORD is required'),
}).superRefine((data, ctx) => {
  if (data.NODE_ENV === 'production') {
    if (!data.DB_SSL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'In production, DB_SSL must be enabled (true).',
        path: ['DB_SSL']
      });
    }
    if (!data.DB_SSL_CA_PATH || data.DB_SSL_CA_PATH.trim() === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'In production, DB_SSL_CA_PATH must be provided.',
        path: ['DB_SSL_CA_PATH']
      });
    } else if (!fs.existsSync(data.DB_SSL_CA_PATH)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `DB_SSL_CA_PATH file does not exist at: ${data.DB_SSL_CA_PATH}`,
        path: ['DB_SSL_CA_PATH']
      });
    }
  }
});

export type BackendEnv = z.infer<typeof BackendEnvSchema>;

export function parseEnv(rawEnv: Record<string, string | undefined> = process.env): BackendEnv {
  const result = BackendEnvSchema.safeParse(rawEnv);
  if (!result.success) {
    const errorDetails = result.error.issues
      .map((i) => `  - [${i.path.join('.') || 'root'}]: ${i.message}`)
      .join('\n');
    throw new Error(`FATAL: Environment validation failed:\n${errorDetails}`);
  }
  return result.data;
}

// Lazy/cached env singleton for runtime
let cachedEnv: BackendEnv | null = null;

export function getEnv(): BackendEnv {
  if (!cachedEnv) {
    cachedEnv = parseEnv(process.env);
  }
  return cachedEnv;
}
