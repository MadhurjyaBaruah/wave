import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool, PoolConfig } from 'pg';
import * as schema from './schema.ts';

declare global {
  var _postgresPool: Pool | undefined;
}

export const createPool = () => {
  if (!global._postgresPool) {
    const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

    let config: PoolConfig;
    if (connectionString) {
      const isLocal = connectionString.includes('localhost') || connectionString.includes('127.0.0.1') || connectionString.includes('sslmode=disable');
      const needsSsl = process.env.SQL_SSL === 'true' || (!isLocal && process.env.SQL_SSL !== 'false');
      config = {
        connectionString,
        ssl: needsSsl ? { rejectUnauthorized: false } : false,
        max: 10,
        connectionTimeoutMillis: 15000,
      };
    } else {
      const useSsl = process.env.SQL_SSL === 'true';
      config = {
        host: process.env.SQL_HOST,
        user: process.env.SQL_USER || process.env.SQL_ADMIN_USER,
        password: process.env.SQL_PASSWORD || process.env.SQL_ADMIN_PASSWORD,
        database: process.env.SQL_DB_NAME,
        port: process.env.SQL_PORT ? parseInt(process.env.SQL_PORT, 10) : 5432,
        ssl: useSsl ? { rejectUnauthorized: false } : false,
        max: 10,
        connectionTimeoutMillis: 15000,
      };
    }

    global._postgresPool = new Pool(config);

    global._postgresPool.on('error', (err) => {
      console.error('Unexpected error on idle SQL pool client:', err);
    });
  }
  return global._postgresPool;
};

const pool = createPool();

export const db = drizzle(pool, { schema });
export { pool };
