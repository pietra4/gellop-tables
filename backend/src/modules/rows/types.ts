export interface RowRecord {
  id: string;
  tableId: string;
  data: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedRows {
  rows: RowRecord[];
  total: number;
  limit: number;
  offset: number;
}

export function mapRow(row: any): RowRecord {
  return {
    id: row.id,
    tableId: row.table_id,
    data: row.data ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
