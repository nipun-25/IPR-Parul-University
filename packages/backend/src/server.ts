
import 'dotenv/config';
import type { Pool } from 'pg';
import { createApp } from './app.js';
import { getEnv } from './config/env.config.js';
import { logger } from './config/logger.config.js';
import { createDatabasePool, createScannerDatabasePool } from './db/pool.js';

async function startServer(): Promise<void> {
  let appPool: Pool | undefined;
  let scannerPool: Pool | undefined;
  let isShuttingDown = false;

  try {
    const env = getEnv();

    // 1. Initialize and verify application PostgreSQL connection (ipr_app)
    appPool = createDatabasePool(env);
    await appPool.query('SELECT 1');
    logger.info('PostgreSQL application pool established successfully');

    // 2. Initialize and verify scanner PostgreSQL connection (ipr_scanner)
    if (!env.SCANNER_DB_PASSWORD || env.SCANNER_DB_PASSWORD.trim().length === 0) {
      throw new Error('FATAL: SCANNER_DB_PASSWORD is required to start backend server with antivirus scanner.');
    }
    scannerPool = createScannerDatabasePool(env);
    await scannerPool.query('SELECT 1');
    logger.info('PostgreSQL scanner pool established successfully');

    const app = createApp(env, {
      dbPool: appPool,
      scannerPool: scannerPool
    });

    const server = app.listen(env.PORT, () => {
      logger.info(
        { port: env.PORT, env: env.NODE_ENV },
        'Parul University IPR Portal API started'
      );
    });

    const shutdown = (signal: string): void => {
      if (isShuttingDown) {
        return;
      }
      isShuttingDown = true;
      logger.info({ signal }, 'Graceful shutdown initiated');

      server.close(async () => {
        try {
          await Promise.allSettled([
            appPool?.end(),
            scannerPool?.end()
          ]);
          logger.info('PostgreSQL application and scanner pools closed');
        } catch (err) {
          logger.error({ err }, 'Error closing PostgreSQL pools during shutdown');
        }
        logger.info('HTTP server and PostgreSQL pools closed');
        process.exit(0);
      });

      setTimeout(() => {
        logger.error('Forced shutdown timeout expired');
        process.exit(1);
      }, 10000).unref();
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    // Gracefully terminate any partially created pools on startup failure
    await Promise.allSettled([
      appPool?.end().catch(() => undefined),
      scannerPool?.end().catch(() => undefined)
    ]);
    const errMsg = error instanceof Error ? error.message : String(error);
    logger.fatal({ err: errMsg }, 'Failed to start backend server');
    process.exit(1);
  }
}

if (
  process.argv[1]?.endsWith('server.ts') ||
  process.argv[1]?.endsWith('server.js')
) {
  void startServer();
}
