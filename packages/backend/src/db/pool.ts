
import { Pool } from 'pg';
import fs from 'node:fs';
import type { BackendEnv } from '../config/env.config.js';
import { logger } from '../config/logger.config.js';

export function createDatabasePool(env: BackendEnv): Pool {
    const pool = new Pool({
        host: env.DB_HOST,
        port: env.DB_PORT,
        database: env.DB_NAME,
        user: env.DB_USER,
        password: env.DB_PASSWORD,
        ssl: env.DB_SSL
            ? {
                ca: fs.readFileSync(env.DB_SSL_CA_PATH!, 'utf8'),
                rejectUnauthorized: true
            }
            : false,
        max: 10,
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 5_000
    });

    pool.on('error', (error) => {
        logger.error({ err: error }, 'Unexpected PostgreSQL pool error');
    });

    return pool;
}
