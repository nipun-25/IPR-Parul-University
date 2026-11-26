
import 'dotenv/config';
import { createApp } from './app.js';
import { getEnv } from './config/env.config.js';
import { logger } from './config/logger.config.js';
import { createDatabasePool } from './db/pool.js';

async function startServer(): Promise<void> {
  let pool: ReturnType<typeof createDatabasePool> | undefined;
  let isShuttingDown = false;

  try {
    const env = getEnv();

    // Initialize and verify PostgreSQL connection
    pool = createDatabasePool(env);
    await pool.query('SELECT 1');

    logger.info('PostgreSQL connection established successfully');

    const app = createApp(env, { dbPool: pool });

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
          await pool?.end();
          logger.info('PostgreSQL pool closed');
        } catch (err) {
          logger.error({ err }, 'Error closing PostgreSQL pool during shutdown');
        }
        logger.info('HTTP server and PostgreSQL pool closed');
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
    await pool?.end().catch(() => undefined);
    logger.fatal({ err: error }, 'Failed to start backend server');
    process.exit(1);
  }
}

if (
  process.argv[1]?.endsWith('server.ts') ||
  process.argv[1]?.endsWith('server.js')
) {
  void startServer();
}
