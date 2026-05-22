import { EventEmitter } from 'events';

type EnrichmentEvent = {
  type: 'enrichment:progress' | 'enrichment:completed' | 'enrichment:failed';
  runId: string;
  tableId: string;
  completedRows: number;
  totalRows: number;
  failedRows: number;
};

class EnrichmentEvents extends EventEmitter {
  emitProgress(event: EnrichmentEvent): boolean {
    return this.emit(event.type, event);
  }
}

export const enrichmentEvents = new EnrichmentEvents();
