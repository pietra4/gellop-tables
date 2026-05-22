export interface User {
  id: string;
  username: string;
  email: string;
}

export interface Column {
  name: string;
  type: 'string' | 'number' | 'date' | 'boolean' | 'enrichment' | 'formula';
  enrichment?: {
    url: string;
    method: 'GET' | 'POST';
    mapping: Record<string, string>;
    concurrency: number;
    delay: number;
    retryCount: number;
  };
  formula?: string;
}

export interface Table {
  id: string;
  userId: string;
  name: string;
  description?: string;
  columns_metadata: Column[];
  created_at: string;
  updated_at: string;
}

export interface Row {
  id: string;
  tableId: string;
  data: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface EnrichmentJob {
  id: string;
  tableId: string;
  rowId: string;
  columnId: string;
  state: 'created' | 'running' | 'completed' | 'failed';
  result?: Record<string, any>;
  error?: string;
  retryCount: number;
  nextRetryAt?: string;
}
