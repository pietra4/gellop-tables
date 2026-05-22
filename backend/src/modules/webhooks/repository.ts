import { query } from '../../core/database.js';
import crypto from 'crypto';

export async function createToken(tableId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex');
  const result = await query(
    'INSERT INTO webhook_tokens (table_id, token) VALUES ($1, $2) RETURNING token',
    [tableId, token]
  );
  return result.rows[0].token;
}

export async function findTableByToken(token: string): Promise<string | null> {
  const result = await query(
    'SELECT table_id FROM webhook_tokens WHERE token = $1',
    [token]
  );
  return result.rows[0]?.table_id ?? null;
}

export async function revokeToken(tableId: string, token: string): Promise<void> {
  await query(
    'DELETE FROM webhook_tokens WHERE table_id = $1 AND token = $2',
    [tableId, token]
  );
}

export async function listTokens(tableId: string): Promise<string[]> {
  const result = await query(
    'SELECT token FROM webhook_tokens WHERE table_id = $1',
    [tableId]
  );
  return result.rows.map((r: any) => r.token);
}
