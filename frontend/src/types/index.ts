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
  description?: string | null;
  columnsMetadata: Column[];
  createdAt: string;
  updatedAt: string;
}

export interface Row {
  id: string;
  tableId: string;
  data: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedRows {
  rows: Row[];
  total: number;
  limit: number;
  offset: number;
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
