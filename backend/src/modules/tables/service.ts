import * as tableRepository from './repository.js';
import { ColumnMeta, TableRecord } from './types.js';
import { CreateTableInput, UpdateTableInput, AddColumnInput } from '../../core/validation.js';
import { ConflictError, NotFoundError, ValidationError } from '../../utils/errors.js';

export async function createTable(userId: string, input: CreateTableInput): Promise<TableRecord> {
  return tableRepository.create(userId, input);
}

export async function listTables(userId: string): Promise<TableRecord[]> {
  return tableRepository.listByUser(userId);
}

export async function getTable(tableId: string, userId: string): Promise<TableRecord> {
  const table = await tableRepository.findById(tableId, userId);
  if (!table) {
    throw new NotFoundError('Table');
  }
  return table;
}

export async function updateTable(
  tableId: string,
  userId: string,
  input: UpdateTableInput
): Promise<TableRecord> {
  return tableRepository.update(tableId, userId, input);
}

export async function deleteTable(tableId: string, userId: string): Promise<void> {
  return tableRepository.deleteById(tableId, userId);
}

/** Adds a column to a table's metadata, rejecting duplicate names. */
export async function addColumn(
  tableId: string,
  userId: string,
  input: AddColumnInput
): Promise<TableRecord> {
  const table = await getTable(tableId, userId);

  if (table.columnsMetadata.some((c) => c.name === input.name)) {
    throw new ConflictError(`Column "${input.name}" already exists`);
  }

  if (input.type === 'enrichment' && !input.enrichment) {
    throw new ValidationError('Enrichment columns require an enrichment config');
  }
  if (input.type === 'formula' && !input.formula) {
    throw new ValidationError('Formula columns require a formula expression');
  }

  const column: ColumnMeta = {
    name: input.name,
    type: input.type,
    ...(input.enrichment ? { enrichment: input.enrichment } : {}),
    ...(input.formula ? { formula: input.formula } : {}),
  };

  return tableRepository.setColumns(tableId, userId, [...table.columnsMetadata, column]);
}

export async function deleteColumn(
  tableId: string,
  userId: string,
  columnName: string
): Promise<TableRecord> {
  const table = await getTable(tableId, userId);
  const next = table.columnsMetadata.filter((c) => c.name !== columnName);
  if (next.length === table.columnsMetadata.length) {
    throw new NotFoundError('Column');
  }
  return tableRepository.setColumns(tableId, userId, next);
}

/**
 * Ensures the given column names exist on the table, inferring string columns
 * for any that are missing. Used by CSV import and webhook ingestion so that
 * incoming data defines the schema on the fly (Clay-like behavior).
 */
export async function ensureColumns(
  tableId: string,
  userId: string,
  columnNames: string[]
): Promise<TableRecord> {
  const table = await getTable(tableId, userId);
  const existing = new Set(table.columnsMetadata.map((c) => c.name));
  const additions: ColumnMeta[] = columnNames
    .filter((name) => !existing.has(name))
    .map((name) => ({ name, type: 'string' as const }));

  if (additions.length === 0) {
    return table;
  }
  return tableRepository.setColumns(tableId, userId, [...table.columnsMetadata, ...additions]);
}
