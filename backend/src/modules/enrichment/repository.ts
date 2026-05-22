import { query, getClient } from '../../core/database.js';
import { NotFoundError } from '../../utils/errors.js';
import { EnrichmentRun, EnrichmentLog, mapEnrichmentRun, mapEnrichmentLog } from './types.js';

// ─── Runs ──────────────────────────────────────────────────────────────────

export async function createRun(
  tableId: string,
  columnName: string,
  totalRows: number,
  config: Record<string, unknown>
): Promise<EnrichmentRun> {
  const result = await query(
    `INSERT INTO enrichment_runs (table_id, column_name, status, total_rows, config)
     VALUES ($1, $2, 'pending', $3, $4::jsonb)
     RETURNING *`,
    [tableId, columnName, totalRows, JSON.stringify(config)]
  );
  return mapEnrichmentRun(result.rows[0]);
}

export async function findRunById(runId: string): Promise<EnrichmentRun | null> {
  const result = await query('SELECT * FROM enrichment_runs WHERE id = $1', [runId]);
  return result.rows[0] ? mapEnrichmentRun(result.rows[0]) : null;
}

export async function findRunsByColumn(
  tableId: string,
  columnName: string,
  limit = 20,
  offset = 0
): Promise<{ runs: EnrichmentRun[]; total: number }> {
  const [rowsResult, countResult] = await Promise.all([
    query(
      `SELECT * FROM enrichment_runs
       WHERE table_id = $1 AND column_name = $2
       ORDER BY created_at DESC LIMIT $3 OFFSET $4`,
      [tableId, columnName, limit, offset]
    ),
    query(
      `SELECT COUNT(*)::int AS total FROM enrichment_runs
       WHERE table_id = $1 AND column_name = $2`,
      [tableId, columnName]
    ),
  ]);
  return {
    runs: rowsResult.rows.map(mapEnrichmentRun),
    total: countResult.rows[0].total,
  };
}

export async function setRunStatus(
  runId: string,
  status: 'pending' | 'running' | 'completed' | 'failed',
  completedAt?: string
): Promise<void> {
  if (status === 'completed' || status === 'failed') {
    await query(
      `UPDATE enrichment_runs SET status = $2, completed_at = $3 WHERE id = $1`,
      [runId, status, completedAt ?? new Date().toISOString()]
    );
  } else {
    await query(`UPDATE enrichment_runs SET status = $2 WHERE id = $1`, [runId, status]);
  }
}

export async function incrementRunProgress(runId: string): Promise<void> {
  await query(
    `UPDATE enrichment_runs SET completed_rows = completed_rows + 1 WHERE id = $1`,
    [runId]
  );
}

export async function incrementRunFailed(runId: string): Promise<void> {
  await query(
    `UPDATE enrichment_runs SET failed_rows = failed_rows + 1 WHERE id = $1`,
    [runId]
  );
}

// ─── Logs ──────────────────────────────────────────────────────────────────

export async function createLog(
  runId: string,
  rowId: string,
  status: 'success' | 'error',
  requestPayload: Record<string, unknown>,
  responseBody: Record<string, unknown> | null,
  errorMessage: string | null
): Promise<void> {
  await query(
    `INSERT INTO enrichment_logs (run_id, row_id, status, request_payload, response_body, error_message)
     VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6)`,
    [
      runId,
      rowId,
      status,
      JSON.stringify(requestPayload),
      responseBody ? JSON.stringify(responseBody) : null,
      errorMessage,
    ]
  );
}

export async function findLogsByRun(
  runId: string,
  limit = 50,
  offset = 0
): Promise<{ logs: EnrichmentLog[]; total: number }> {
  const [rowsResult, countResult] = await Promise.all([
    query(
      `SELECT * FROM enrichment_logs
       WHERE run_id = $1
       ORDER BY created_at ASC LIMIT $2 OFFSET $3`,
      [runId, limit, offset]
    ),
    query(
      'SELECT COUNT(*)::int AS total FROM enrichment_logs WHERE run_id = $1',
      [runId]
    ),
  ]);
  return {
    logs: rowsResult.rows.map(mapEnrichmentLog),
    total: countResult.rows[0].total,
  };
}
