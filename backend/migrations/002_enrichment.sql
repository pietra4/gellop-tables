-- Enrichment runs tracking
CREATE TABLE IF NOT EXISTS enrichment_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_id UUID NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
  column_name VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  total_rows INT NOT NULL DEFAULT 0,
  completed_rows INT NOT NULL DEFAULT 0,
  failed_rows INT NOT NULL DEFAULT 0,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_enrichment_runs_table_column ON enrichment_runs(table_id, column_name);
CREATE INDEX IF NOT EXISTS idx_enrichment_runs_status ON enrichment_runs(status);

-- Enrichment execution logs (one per row per run)
CREATE TABLE IF NOT EXISTS enrichment_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  run_id UUID NOT NULL REFERENCES enrichment_runs(id) ON DELETE CASCADE,
  row_id UUID NOT NULL REFERENCES rows(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL CHECK (status IN ('success', 'error')),
  request_payload JSONB,
  response_body JSONB,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_enrichment_logs_run ON enrichment_logs(run_id);
CREATE INDEX IF NOT EXISTS idx_enrichment_logs_row ON enrichment_logs(row_id);
