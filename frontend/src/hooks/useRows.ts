import { create } from 'zustand';
import client from '../api/client';
import { Row, PaginatedRows } from '../types';

interface RowFilters {
  [key: string]: string;
}

interface RowsState {
  rows: Row[];
  total: number;
  loading: boolean;
  error: string | null;
  filters: RowFilters;
  sortColumn: string | null;
  sortDirection: 'asc' | 'desc';
  fetchRows: (tableId: string, limit?: number, offset?: number) => Promise<void>;
  createRow: (tableId: string, data: Record<string, unknown>) => Promise<Row>;
  updateRow: (tableId: string, rowId: string, data: Record<string, unknown>) => Promise<void>;
  deleteRow: (tableId: string, rowId: string) => Promise<void>;
  importCsv: (tableId: string, csvContent: string) => Promise<{ imported: number; columns: string[] }>;
  setFilters: (filters: RowFilters) => void;
  setSort: (column: string | null, direction: 'asc' | 'desc') => void;
}

function msg(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'response' in error) {
    const err = error as { response?: { data?: { error?: string } } };
    return err.response?.data?.error || fallback;
  }
  return fallback;
}

export const useRows = create<RowsState>((set, get) => ({
  rows: [],
  total: 0,
  loading: false,
  error: null,
  filters: {},
  sortColumn: null,
  sortDirection: 'asc',

  fetchRows: async (tableId: string, limit = 100, offset = 0) => {
    set({ loading: true, error: null });
    try {
      const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
      // Add sort params
      const sortCol = get().sortColumn;
      if (sortCol) {
        params.set('sort', sortCol);
        params.set('dir', get().sortDirection);
      }
      // Add filters
      const filters = get().filters;
      Object.entries(filters).forEach(([col, val]) => {
        if (val) params.set(`filter[${col}]`, val);
      });

      const response = await client.get<PaginatedRows>(`/tables/${tableId}/rows?${params}`);
      set({ rows: response.data.rows, total: response.data.total, loading: false });
    } catch (error) {
      set({ error: msg(error, 'Failed to load rows'), loading: false });
    }
  },

  createRow: async (tableId: string, data: Record<string, unknown>) => {
    const response = await client.post<Row>(`/tables/${tableId}/rows`, { data });
    set({ rows: [...get().rows, response.data], total: get().total + 1 });
    return response.data;
  },

  updateRow: async (tableId: string, rowId: string, data: Record<string, unknown>) => {
    const response = await client.patch<Row>(`/tables/${tableId}/rows/${rowId}`, { data });
    set({
      rows: get().rows.map((r) => (r.id === rowId ? response.data : r)),
    });
  },

  deleteRow: async (tableId: string, rowId: string) => {
    await client.delete(`/tables/${tableId}/rows/${rowId}`);
    set({
      rows: get().rows.filter((r) => r.id !== rowId),
      total: get().total - 1,
    });
  },

  importCsv: async (tableId: string, csvContent: string) => {
    try {
      const response = await client.post(`/tables/${tableId}/import`, csvContent, {
        headers: { 'Content-Type': 'text/csv' },
      });
      return response.data;
    } catch (error) {
      if (error && typeof error === 'object' && 'response' in error) {
        const err = error as { response?: unknown };
        // Backend has already parsed and responded: do not hide real CSV errors with a second call.
        if (err.response) {
          throw error;
        }
      }
      // Fallback only for transport/parser edge cases.
      const response = await client.post(`/tables/${tableId}/import`, { content: csvContent });
      return response.data;
    }
  },

  setFilters: (filters: RowFilters) => {
    set({ filters });
  },

  setSort: (column: string | null, direction: 'asc' | 'desc') => {
    set({ sortColumn: column, sortDirection: direction });
  },
}));
