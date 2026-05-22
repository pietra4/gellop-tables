import { create } from 'zustand';
import client from '../api/client';
import { Table, Column } from '../types';

interface CreateTablePayload {
  name: string;
  description?: string;
}

interface TablesState {
  tables: Table[];
  loading: boolean;
  error: string | null;
  fetchTables: () => Promise<void>;
  getTable: (id: string) => Promise<Table>;
  createTable: (payload: CreateTablePayload) => Promise<Table>;
  deleteTable: (id: string) => Promise<void>;
  addColumn: (tableId: string, column: Partial<Column> & { name: string; type: string }) => Promise<Table>;
}

function message(error: any, fallback: string): string {
  return error.response?.data?.error || fallback;
}

export const useTables = create<TablesState>((set, get) => ({
  tables: [],
  loading: false,
  error: null,

  fetchTables: async () => {
    set({ loading: true, error: null });
    try {
      const response = await client.get<Table[]>('/tables');
      set({ tables: response.data });
    } catch (error: any) {
      set({ error: message(error, 'Failed to load tables') });
    } finally {
      set({ loading: false });
    }
  },

  getTable: async (id) => {
    set({ error: null });
    try {
      const response = await client.get<Table>(`/tables/${id}`);
      set({
        tables: get().tables.some((t) => t.id === id)
          ? get().tables.map((t) => (t.id === id ? response.data : t))
          : [response.data, ...get().tables],
      });
      return response.data;
    } catch (error: any) {
      const msg = message(error, 'Failed to load table');
      set({ error: msg });
      throw new Error(msg);
    }
  },

  createTable: async (payload) => {
    set({ error: null });
    try {
      const response = await client.post<Table>('/tables', payload);
      set({ tables: [response.data, ...get().tables] });
      return response.data;
    } catch (error: any) {
      const msg = message(error, 'Failed to create table');
      set({ error: msg });
      throw new Error(msg);
    }
  },

  deleteTable: async (id) => {
    set({ error: null });
    try {
      await client.delete(`/tables/${id}`);
      set({ tables: get().tables.filter((t) => t.id !== id) });
    } catch (error: any) {
      set({ error: message(error, 'Failed to delete table') });
    }
  },

  addColumn: async (tableId, column) => {
    const response = await client.post<Table>(`/tables/${tableId}/columns`, column);
    set({ tables: get().tables.map((t) => (t.id === tableId ? response.data : t)) });
    return response.data;
  },
}));
