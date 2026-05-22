// @ts-nocheck
import { jest } from '@jest/globals';

jest.mock('../../src/core/database.js', () => ({
  __esModule: true,
  query: jest.fn(),
  getClient: jest.fn(),
  initializeDatabase: jest.fn(),
  closeDatabase: jest.fn(),
}));

jest.mock('../../src/modules/rows/repository.js', () => ({
  __esModule: true,
  listByTable: jest.fn(),
}));

import { query } from '../../src/core/database.js';
import * as tableService from '../../src/modules/tables/service.js';

function rawTable(overrides = {}) {
  return {
    id: 't1',
    user_id: 'u1',
    name: 'Leads',
    description: null,
    columns_metadata: [],
    created_at: 'now',
    updated_at: 'now',
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('tableService.createTable', () => {
  it('inserts and returns a mapped table', async () => {
    query.mockResolvedValueOnce({ rows: [rawTable()], rowCount: 1 });
    const table = await tableService.createTable('u1', { name: 'Leads' });

    expect(table).toMatchObject({ id: 't1', userId: 'u1', name: 'Leads', columnsMetadata: [] });
    const [sql, params] = query.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO tables/i);
    expect(params?.[0]).toBe('u1');
  });
});

describe('tableService.getTable', () => {
  it('returns the table when found', async () => {
    query.mockResolvedValueOnce({ rows: [rawTable()], rowCount: 1 });
    const table = await tableService.getTable('t1', 'u1');
    expect(table.id).toBe('t1');
    expect(query.mock.calls[0][1]).toEqual(['t1', 'u1']);
  });

  it('throws NotFoundError when the table is missing', async () => {
    query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    await expect(tableService.getTable('t1', 'u1')).rejects.toThrow(/not found/i);
  });
});

describe('tableService.addColumn', () => {
  it('appends a string column', async () => {
    query
      .mockResolvedValueOnce({ rows: [rawTable()], rowCount: 1 })
      .mockResolvedValueOnce({
        rows: [rawTable({ columns_metadata: [{ name: 'email', type: 'string' }] })],
        rowCount: 1,
      });

    const table = await tableService.addColumn('t1', 'u1', { name: 'email', type: 'string' });
    expect(table.columnsMetadata).toEqual([{ name: 'email', type: 'string' }]);
  });

  it('rejects a duplicate column name', async () => {
    query.mockResolvedValueOnce({
      rows: [rawTable({ columns_metadata: [{ name: 'email', type: 'string' }] })],
      rowCount: 1,
    });
    await expect(
      tableService.addColumn('t1', 'u1', { name: 'email', type: 'string' })
    ).rejects.toThrow(/already exists/i);
  });

  it('requires an enrichment config for enrichment columns', async () => {
    query.mockResolvedValueOnce({ rows: [rawTable()], rowCount: 1 });
    await expect(
      tableService.addColumn('t1', 'u1', { name: 'data', type: 'enrichment' })
    ).rejects.toThrow(/enrichment config/i);
  });
});

describe('tableService.ensureColumns', () => {
  it('adds only the missing columns inferred as strings', async () => {
    query
      .mockResolvedValueOnce({
        rows: [rawTable({ columns_metadata: [{ name: 'name', type: 'string' }] })],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [
          rawTable({
            columns_metadata: [
              { name: 'name', type: 'string' },
              { name: 'email', type: 'string' },
            ],
          }),
        ],
        rowCount: 1,
      });

    const table = await tableService.ensureColumns('t1', 'u1', ['name', 'email']);
    expect(table.columnsMetadata.map((c) => c.name)).toEqual(['name', 'email']);
  });

  it('does not touch the DB when all columns already exist', async () => {
    query.mockResolvedValueOnce({
      rows: [rawTable({ columns_metadata: [{ name: 'name', type: 'string' }] })],
      rowCount: 1,
    });
    await tableService.ensureColumns('t1', 'u1', ['name']);
    expect(query).toHaveBeenCalledTimes(1);
  });
});

describe('tableService.deleteColumn', () => {
  it('throws NotFoundError when the column is absent', async () => {
    query.mockResolvedValueOnce({ rows: [rawTable()], rowCount: 1 });
    await expect(tableService.deleteColumn('t1', 'u1', 'ghost')).rejects.toThrow(/not found/i);
  });
});
