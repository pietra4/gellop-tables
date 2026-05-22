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

    const migrationPath = path.join(__dirname, '../../migrations/001_init_schema.sql');
    const sql = fs.readFileSync(migrationPath, 'utf-8');

    await client.query(sql);
    logger.info('Database initialization complete');
  } catch (error) {
    logger.error('Database initialization failed', error);
    throw error;
  } finally {
    client.release();
  }
}

export async function query(text: string, params?: (string | number | boolean | object)[]): Promise<any> {
  return pool.query(text, params);
}

export async function getClient(): Promise<PoolClient> {
  return pool.connect();
}

export async function closeDatabase(): Promise<void> {
  await pool.end();
}

export default pool;
