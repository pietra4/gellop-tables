import { Pool, PoolClient } from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on('error', (err) => {
  logger.error('Unexpected error on idle client', err);
});

export async function initializeDatabase(): Promise<void> {
  const client = await pool.connect();
  try {
    logger.info('Initializing database...');

    for (const migrationFile of ['001_init_schema.sql', '002_enrichment.sql']) {
      const migrationPath = path.join(__dirname, '../../migrations', migrationFile);
      if (fs.existsSync(migrationPath)) {
        const sql = fs.readFileSync(migrationPath, 'utf-8');
        await client.query(sql);
        logger.info(`Applied migration: ${migrationFile}`);
      }
    }

    logger.info('Database initialization complete');
  } catch (error) {
    logger.error('Database initialization failed', error);
    throw error;
  } finally {
    client.release();
  }
}

export type QueryParam = string | number | boolean | object | null;

export async function query(text: string, params?: QueryParam[]): Promise<any> {
  return pool.query(text, params);
}

export async function getClient(): Promise<PoolClient> {
  return pool.connect();
}

export async function closeDatabase(): Promise<void> {
  await pool.end();
}

export default pool;
