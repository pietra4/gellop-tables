export type ColumnType = 'string' | 'number' | 'date' | 'boolean' | 'enrichment' | 'formula';

export interface EnrichmentConfig {
  url: string;
  method: 'GET' | 'POST';
  mapping: Record<string, string>;
  concurrency: number;
  delay: number;
  retryCount: number;
}

export interface ColumnMeta {
  name: string;
  type: ColumnType;
  enrichment?: EnrichmentConfig;
  formula?: string;
}

export interface TableRecord {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  columnsMetadata: ColumnMeta[];
  createdAt: string;
  updatedAt: string;
}

/** Maps a raw DB row (snake_case) to a domain TableRecord (camelCase). */
export function mapTableRow(row: any): TableRecord {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    description: row.description ?? null,
    columnsMetadata: row.columns_metadata ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
