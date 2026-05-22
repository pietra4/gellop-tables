export interface EnrichmentRun {
  id: string;
  columnId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  totalRows: number;
  completedRows: number;
  failedRows: number;
  config: EnrichmentConfig;
  createdAt: string;
  completedAt: string | null;
}

export interface EnrichmentLog {
  id: string;
  runId: string;
  rowId: string;
  status: 'success' | 'error';
  requestPayload: Record<string, unknown>;
  responseBody: Record<string, unknown> | null;
  errorMessage: string | null;
  createdAt: string;
}

export interface EnrichmentConfig {
  url: string;
  method: 'GET' | 'POST';
  headers: Record<string, string>;
  requestTemplate: Record<string, string>;
  responseMapping: Record<string, string>;
  outputColumns: { name: string; path: string }[];
  maxConcurrency: number;
}

export function mapEnrichmentRun(row: any): EnrichmentRun {
  return {
    id: row.id,
    columnId: row.column_id,
    status: row.status,
    totalRows: row.total_rows,
    completedRows: row.completed_rows,
    failedRows: row.failed_rows,
    config: row.config,
    createdAt: row.created_at,
    completedAt: row.completed_at ?? null,
  };
}

export function mapEnrichmentLog(row: any): EnrichmentLog {
  return {
    id: row.id,
    runId: row.run_id,
    rowId: row.row_id,
    status: row.status,
    requestPayload: row.request_payload,
    responseBody: row.response_body,
    errorMessage: row.error_message,
    createdAt: row.created_at,
  };
}
