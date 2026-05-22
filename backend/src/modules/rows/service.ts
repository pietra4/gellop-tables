import * as rowRepository from './repository.js';
import * as tableService from '../tables/service.js';
import { RowRecord, PaginatedRows } from './types.js';
import { parseCsv } from '../../utils/csv.js';
import { NotFoundError, ValidationError } from '../../utils/errors.js';
import { ColumnMeta } from '../tables/types.js';

export const MAX_PAGE_SIZE = 1000;
export const DEFAULT_PAGE_SIZE = 100;

/** Hard cap on rows accepted in a single CSV import to protect memory. */
export const MAX_IMPORT_ROWS = 100_000;

export interface ImportResult {
  imported: number;
  columns: string[];
}

export interface RowQuery {
  limit: number;
  offset: number;
  sort?: string;
  dir?: 'asc' | 'desc';
  filters?: Record<string, string>;
}

/** Verifies the user owns the table, throwing 404 otherwise. */
async function assertTableAccess(tableId: string, userId: string): Promise<void> {
  await tableService.getTable(tableId, userId);
}

export async function createRow(
  tableId: string,
  userId: string,
  data: Record<string, unknown>
): Promise<RowRecord> {
  await assertTableAccess(tableId, userId);
  if (Object.keys(data).length > 0) {
    await tableService.ensureColumns(tableId, userId, Object.keys(data));
  }
  return rowRepository.create(tableId, data);
}

export async function listRows(
  tableId: string,
  userId: string,
  query: RowQuery
): Promise<PaginatedRows> {
  await assertTableAccess(tableId, userId);
  const safeLimit = Math.min(Math.max(query.limit, 1), MAX_PAGE_SIZE);
  const safeOffset = Math.max(query.offset, 0);
  return rowRepository.listByTable(tableId, safeLimit, safeOffset, query.sort, query.dir, query.filters);
}

export async function getRow(rowId: string, tableId: string, userId: string): Promise<RowRecord> {
  await assertTableAccess(tableId, userId);
  const row = await rowRepository.findById(rowId, tableId);
  if (!row) {
    throw new NotFoundError('Row');
  }
  return row;
}

export async function updateRow(
  rowId: string,
  tableId: string,
  userId: string,
  data: Record<string, unknown>
): Promise<RowRecord> {
  await assertTableAccess(tableId, userId);
  await tableService.ensureColumns(tableId, userId, Object.keys(data));
  return rowRepository.update(rowId, tableId, data);
}

export async function deleteRow(rowId: string, tableId: string, userId: string): Promise<void> {
  await assertTableAccess(tableId, userId);
  return rowRepository.deleteById(rowId, tableId);
}

/**
 * Imports CSV content into a table: parses the text, registers any new columns
 * on the table metadata, and bulk-inserts the rows.
 */
export async function importCsv(
  tableId: string,
  userId: string,
  csvContent: string
): Promise<ImportResult> {
  await assertTableAccess(tableId, userId);

  let parsed;
  try {
    parsed = parseCsv(csvContent);
  } catch (error) {
    throw new ValidationError(
      `CSV parse error: ${error instanceof Error ? error.message : 'unknown'}`
    );
  }

  if (parsed.headers.length === 0) {
    throw new ValidationError('CSV has no header row');
  }
  if (parsed.records.length === 0) {
    throw new ValidationError('CSV has no data rows');
  }
  if (parsed.records.length > MAX_IMPORT_ROWS) {
    throw new ValidationError(
      `CSV exceeds the ${MAX_IMPORT_ROWS}-row import limit (${parsed.records.length} rows)`
    );
  }

  await tableService.ensureColumns(tableId, userId, parsed.headers);
  const imported = await rowRepository.bulkInsert(tableId, parsed.records);

  return { imported, columns: parsed.headers };
}

/** Exports all rows to CSV text. */
export async function exportCsv(tableId: string, userId: string): Promise<string> {
  const table = await tableService.getTable(tableId, userId);
  const allRows = await rowRepository.listAllByTable(tableId);

  const colNames = table.columnsMetadata.map((c: ColumnMeta) => c.name);

  const escapeCsv = (val: unknown): string => {
    const s = val === null || val === undefined ? '' : String(val);
    if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const lines: string[] = [colNames.map(escapeCsv).join(',')];
  for (const row of allRows) {
    lines.push(colNames.map((name) => escapeCsv(row.data[name])).join(','));
  }

  return lines.join('\n');
}
