import { query, getClient, QueryParam } from '../../core/database.js';
import { NotFoundError } from '../../utils/errors.js';
import { RowRecord, PaginatedRows, mapRow } from './types.js';

/** Max rows per multi-value INSERT statement to keep parameter counts sane. */
const INSERT_CHUNK_SIZE = 500;

export async function create(tableId: string, data: Record<string, unknown>): Promise<RowRecord> {
  const result = await query(
    'INSERT INTO rows (table_id, data) VALUES ($1, $2::jsonb) RETURNING *',
    [tableId, JSON.stringify(data)]
  );
  return mapRow(result.rows[0]);
}

export async function listByTable(
  tableId: string,
  limit: number,
  offset: number,
  sort?: string,
  dir?: 'asc' | 'desc',
  filters?: Record<string, string>
): Promise<PaginatedRows> {
  const params: any[] = [tableId];
  let whereClause = 'WHERE table_id = $1';
  let paramIdx = 1;

  // Add filters (JSONB text field matching)
  if (filters) {
    for (const [col, val] of Object.entries(filters)) {
      if (!val) continue;
      paramIdx++;
      whereClause += ` AND data->>'${col.replace(/'/g, "''")}' ILIKE $${paramIdx}`;
      params.push(`%${val}%`);
    }
  }

  const safeDir = dir === 'desc' ? 'DESC' : 'ASC';
  let orderClause = 'ORDER BY created_at ASC';
  if (sort) {
    // Use jsonb_path_query for sort; data->>key is text, cast if needed
    const sanitizedCol = sort.replace(/'/g, "''");
    orderClause = `ORDER BY data->>'${sanitizedCol}' ${safeDir} NULLS LAST`;
  }

  const queryParams = [...params, limit, offset];
  const [rowsResult, countResult] = await Promise.all([
    query(
      `SELECT * FROM rows ${whereClause} ${orderClause} LIMIT $${paramIdx + 1} OFFSET $${paramIdx + 2}`,
      queryParams as any
    ),
    query(`SELECT COUNT(*)::int AS total FROM rows ${whereClause}`, params as any),
  ]);

  return {
    rows: rowsResult.rows.map(mapRow),
    total: countResult.rows[0].total,
    limit,
    offset,
  };
}

export async function findById(rowId: string, tableId: string): Promise<RowRecord | null> {
  const result = await query(
    'SELECT * FROM rows WHERE id = $1 AND table_id = $2',
    [rowId, tableId]
  );
  return result.rows[0] ? mapRow(result.rows[0]) : null;
}

export async function update(
  rowId: string,
  tableId: string,
  data: Record<string, unknown>
): Promise<RowRecord> {
  const result = await query(
    `UPDATE rows SET data = $3::jsonb, updated_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND table_id = $2 RETURNING *`,
    [rowId, tableId, JSON.stringify(data)]
  );
  if (result.rowCount === 0) {
    throw new NotFoundError('Row');
  }
  return mapRow(result.rows[0]);
}

/** Merges a partial object into a row's existing JSONB data (used by enrichment). */
export async function patchData(
  rowId: string,
  tableId: string,
  partial: Record<string, unknown>
): Promise<RowRecord> {
  const result = await query(
    `UPDATE rows SET data = data || $3::jsonb, updated_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND table_id = $2 RETURNING *`,
    [rowId, tableId, JSON.stringify(partial)]
  );
  if (result.rowCount === 0) {
    throw new NotFoundError('Row');
  }
  return mapRow(result.rows[0]);
}

export async function deleteById(rowId: string, tableId: string): Promise<void> {
  const result = await query(
    'DELETE FROM rows WHERE id = $1 AND table_id = $2',
    [rowId, tableId]
  );
  if (result.rowCount === 0) {
    throw new NotFoundError('Row');
  }
}

/**
 * Bulk-inserts many rows in a single transaction, chunked into multi-value
 * INSERTs. Returns the number of rows inserted. Designed for CSV import of
 * tens of thousands of rows.
 */
export async function bulkInsert(
  tableId: string,
  records: Record<string, unknown>[]
): Promise<number> {
  if (records.length === 0) {
    return 0;
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');
    let inserted = 0;

    for (let start = 0; start < records.length; start += INSERT_CHUNK_SIZE) {
      const chunk = records.slice(start, start + INSERT_CHUNK_SIZE);
      const values: string[] = [];
      const params: unknown[] = [];

      chunk.forEach((record, idx) => {
        const tableParam = idx * 2 + 1;
        const dataParam = idx * 2 + 2;
        values.push(`($${tableParam}, $${dataParam}::jsonb)`);
        params.push(tableId, JSON.stringify(record));
      });

      const result = await client.query(
        `INSERT INTO rows (table_id, data) VALUES ${values.join(', ')}`,
        params
      );
      inserted += result.rowCount ?? 0;
    }

    await client.query('COMMIT');
    return inserted;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/** Returns every row id for a table (used to enqueue enrichment jobs). */
export async function listIds(tableId: string): Promise<string[]> {
  const result = await query('SELECT id FROM rows WHERE table_id = $1', [tableId]);
  return result.rows.map((r: any) => r.id);
}

/** Returns all rows for a table (no pagination — used for export). */
export async function listAllByTable(tableId: string): Promise<RowRecord[]> {
  const result = await query(
    'SELECT * FROM rows WHERE table_id = $1 ORDER BY created_at ASC',
    [tableId]
  );
  return result.rows.map(mapRow);
}
