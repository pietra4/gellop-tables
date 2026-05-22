import { query } from '../../core/database.js';
import { NotFoundError } from '../../utils/errors.js';
import { ColumnMeta, TableRecord, mapTableRow } from './types.js';

interface CreateTableData {
  name: string;
  description?: string;
}

interface UpdateTableData {
  name?: string;
  description?: string;
}

export async function create(userId: string, input: CreateTableData): Promise<TableRecord> {
  const result = await query(
    `INSERT INTO tables (user_id, name, description, columns_metadata)
     VALUES ($1, $2, $3, $4::jsonb)
     RETURNING *`,
    [userId, input.name, input.description ?? null, JSON.stringify([])]
  );
  return mapTableRow(result.rows[0]);
}

export async function listByUser(userId: string): Promise<TableRecord[]> {
  const result = await query(
    'SELECT * FROM tables WHERE user_id = $1 ORDER BY created_at DESC',
    [userId]
  );
  return result.rows.map(mapTableRow);
}

export async function findById(tableId: string, userId: string): Promise<TableRecord | null> {
  const result = await query(
    'SELECT * FROM tables WHERE id = $1 AND user_id = $2',
    [tableId, userId]
  );
  return result.rows[0] ? mapTableRow(result.rows[0]) : null;
}

export async function update(
  tableId: string,
  userId: string,
  input: UpdateTableData
): Promise<TableRecord> {
  const result = await query(
    `UPDATE tables
     SET name = COALESCE($3, name),
         description = COALESCE($4, description),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND user_id = $2
     RETURNING *`,
    [tableId, userId, input.name ?? null, input.description ?? null]
  );
  if (result.rowCount === 0) {
    throw new NotFoundError('Table');
  }
  return mapTableRow(result.rows[0]);
}

export async function deleteById(tableId: string, userId: string): Promise<void> {
  const result = await query(
    'DELETE FROM tables WHERE id = $1 AND user_id = $2',
    [tableId, userId]
  );
  if (result.rowCount === 0) {
    throw new NotFoundError('Table');
  }
}

export async function setColumns(
  tableId: string,
  userId: string,
  columns: ColumnMeta[]
): Promise<TableRecord> {
  const result = await query(
    `UPDATE tables
     SET columns_metadata = $3::jsonb, updated_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND user_id = $2
     RETURNING *`,
    [tableId, userId, JSON.stringify(columns)]
  );
  if (result.rowCount === 0) {
    throw new NotFoundError('Table');
  }
  return mapTableRow(result.rows[0]);
}
