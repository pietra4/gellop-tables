// @ts-nocheck
import { jest } from '@jest/globals';

jest.mock('../../src/core/database.js', () => ({
  __esModule: true,
  query: jest.fn(),
  getClient: jest.fn(),
  initializeDatabase: jest.fn(),
  closeDatabase: jest.fn(),
}));

jest.mock('../../src/modules/tables/service.js', () => ({
  __esModule: true,
  getTable: jest.fn(),
  ensureColumns: jest.fn(),
}));

import { query, getClient } from '../../src/core/database.js';
import * as rowService from '../../src/modules/rows/service.js';
import * as tableService from '../../src/modules/tables/service.js';

const clientQuery = jest.fn();
const release = jest.fn();

/** Count the number of rows implied by an INSERT's VALUES tuples. */
function countInsertRows(_sql: string, params?: unknown[]): number {
  // Multi-value INSERT: 2 params per row (tableId, data)
  if (!params) return 0;
  const firstSql = typeof _sql === 'string' ? _sql : String(_sql);
  const match = firstSql.match(/VALUES\s*\((.*?)\)/);
  if (!match) return 0;
  const valuesCount = (match[1].match(/\$/g) || []).length;
  return valuesCount ? params.length / valuesCount : 0;
}

beforeEach(() => {
  jest.clearAllMocks();

  query.mockResolvedValue({ rows: [], rowCount: 1 });
  getClient.mockResolvedValue({ query: clientQuery, release });
  tableService.getTable.mockResolvedValue({
    id: 't1', userId: 'u1', name: 'Test', columnsMetadata: [],
  });
  tableService.ensureColumns.mockResolvedValue({});

  clientQuery.mockImplementation(async (_sql, params) => {
    const sql = String(_sql);
    if (sql.trim().startsWith('INSERT')) {
      const n = countInsertRows(sql, params);
      return { rowCount: n };
    }
    if (sql.trim() === 'BEGIN' || sql.trim() === 'COMMIT' || sql.trim() === 'ROLLBACK') {
      return { rowCount: 0 };
    }
    return { rowCount: 0, rows: [] };
  });
});

describe('importCsv', () => {
  it('imports CSV data', async () => {
    const result = await rowService.importCsv('t1', 'u1', 'a,b\n1,2\n3,4');
    expect(result.imported).toBe(2);
    expect(result.columns).toEqual(['a', 'b']);
  });

  it('rejects no-data CSV', async () => {
    await expect(rowService.importCsv('t1', 'u1', 'a,b')).rejects.toThrow(/no data/i);
  });

  it('rejects duplicate headers', async () => {
    await expect(rowService.importCsv('t1', 'u1', 'a,a\n1,2')).rejects.toThrow(/parse/i);
  });
});

describe('createRow', () => {
  it('creates a row', async () => {
    query.mockResolvedValue({
      rows: [{ id: 'r1', table_id: 't1', data: { name: 'Ada' }, created_at: 'now', updated_at: 'now' }],
      rowCount: 1,
    });
    const row = await rowService.createRow('t1', 'u1', { name: 'Ada' });
    expect(row.id).toBe('r1');
    expect(row.data.name).toBe('Ada');
  });
});

describe('exportCsv', () => {
  it('generates CSV from table data', async () => {
    tableService.getTable.mockResolvedValue({
      id: 't1',
      userId: 'u1',
      name: 'Test',
      columnsMetadata: [{ name: 'a', type: 'string' }, { name: 'b', type: 'string' }],
    });
    query.mockResolvedValue({
      rows: [
        { id: 'r1', table_id: 't1', data: { a: '1', b: '2' }, created_at: 'now', updated_at: 'now' },
        { id: 'r2', table_id: 't1', data: { a: '3', b: '4' }, created_at: 'now', updated_at: 'now' },
      ],
      rowCount: 2,
    });

    const csv = await rowService.exportCsv('t1', 'u1');
    expect(csv).toBe('a,b\n1,2\n3,4');
  });
});
