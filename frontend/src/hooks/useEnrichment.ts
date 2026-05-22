import { create } from 'zustand';
import client from '../api/client';

export interface EnrichmentRun {
  id: string;
  columnId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  totalRows: number;
  completedRows: number;
  failedRows: number;
  config: Record<string, unknown>;
  createdAt: string;
  completedAt: string | null;
}

interface EnrichmentState {
  runs: EnrichmentRun[];
  currentRun: EnrichmentRun | null;
  loading: boolean;
  error: string | null;
  startEnrichment: (tableId: string, columnName: string) => Promise<EnrichmentRun>;
  fetchRuns: (tableId: string, columnName: string, limit?: number) => Promise<void>;
  fetchRun: (runId: string) => Promise<void>;
  updateRunProgress: (runId: string, completed: number, total: number, failed: number) => void;
}

export const useEnrichment = create<EnrichmentState>((set, get) => ({
  runs: [],
  currentRun: null,
  loading: false,
  error: null,

  startEnrichment: async (tableId: string, columnName: string) => {
    set({ loading: true, error: null });
    try {
      const response = await client.post(`/tables/${tableId}/enrich`, { columnName });
      const run = response.data;
      set({ currentRun: run, runs: [run, ...get().runs], loading: false });
      return run;
    } catch (error: any) {
      const msg = error.response?.data?.error || 'Failed to start enrichment';
      set({ error: msg, loading: false });
      throw new Error(msg);
    }
  },

  fetchRuns: async (tableId: string, columnName: string, limit = 20) => {
    try {
      const response = await client.get(`/tables/${tableId}/enrich/runs`, {
        params: { columnName, limit },
      });
      set({ runs: response.data.runs });
    } catch {
      // silent
    }
  },

  fetchRun: async (runId: string) => {
    try {
      const response = await client.get(`/tables/${runId}/enrich/runs/${runId}`);
      set({ currentRun: response.data });
      return response.data;
    } catch {
      // silent
    }
  },

  updateRunProgress: (runId: string, completed: number, total: number, failed: number) => {
    const run = get().currentRun;
    if (run && run.id === runId) {
      set({
        currentRun: {
          ...run,
          completedRows: completed,
          totalRows: total,
          failedRows: failed,
          status: completed + failed >= total ? 'completed' : 'running',
        },
      });
    }
  },
}));
