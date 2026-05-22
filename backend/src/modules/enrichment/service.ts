import * as enrichmentRepository from './repository.js';
import * as rowRepository from '../rows/repository.js';
import * as tableService from '../tables/service.js';
import { NotFoundError, ValidationError } from '../../utils/errors.js';
import logger from '../../utils/logger.js';
import { EnrichmentRun, EnrichmentConfig } from './types.js';
import { ColumnMeta } from '../tables/types.js';
import { enrichmentEvents } from './events.js';

function resolvePath(obj: unknown, path: string): unknown {
  return path.split('.').reduce((acc: unknown, key: string) => {
    const dict = acc as Record<string, unknown> | null;
    if (dict && typeof dict === 'object' && key in dict) {
      return dict[key];
    }
    return null;
  }, obj);
}

function compileTemplate(template: Record<string, string>, rowData: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(template)) {
    let resolved = value;
    // Replace {{col_name}} with row data values
    const matches = value.match(/\{\{(.+?)\}\}/g);
    if (matches) {
      for (const match of matches) {
        const colName = match.slice(2, -2).trim();
        const val = rowData[colName];
        resolved = resolved.replace(match, val !== undefined ? String(val) : '');
      }
    }
    result[key] = resolved;
  }
  return result;
}

async function executeApiCall(
  config: EnrichmentConfig,
  compiledPayload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const url = new URL(config.url);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...config.headers,
  };

  let response: Response;

  if (config.method === 'GET') {
    url.search = new URLSearchParams(
      compiledPayload as Record<string, string>
    ).toString();
    response = await fetch(url.toString(), { headers });
  } else {
    response = await fetch(url.toString(), {
      method: 'POST',
      headers,
      body: JSON.stringify(compiledPayload),
    });
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`API returned ${response.status}: ${body.slice(0, 500)}`);
  }

  const body = (await response.json()) as Record<string, unknown>;
  return body;
}

function mapResponse(body: Record<string, unknown>, responseMapping: Record<string, string>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [outputField, jsonPath] of Object.entries(responseMapping)) {
    const value = resolvePath(body, jsonPath.replace(/^\$\./, ''));
    result[outputField] = value !== null ? value : null;
  }
  return result;
}

async function processRow(
  rowId: string,
  config: EnrichmentConfig,
  rowData: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const compiledPayload = compileTemplate(config.requestTemplate, rowData);
  const apiResponse = await executeApiCall(config, compiledPayload);
  return mapResponse(apiResponse, config.responseMapping);
}

export async function startEnrichment(
  tableId: string,
  userId: string,
  columnName: string
): Promise<EnrichmentRun> {
  const table = await tableService.getTable(tableId, userId);
  const colMeta = table.columnsMetadata.find((c: ColumnMeta) => c.name === columnName);

  if (!colMeta) {
    throw new NotFoundError(`Column "${columnName}"`);
  }
  if (colMeta.type !== 'enrichment' || !colMeta.enrichment) {
    throw new ValidationError(`Column "${columnName}" is not an enrichment column`);
  }

  // Get all row IDs for this table
  const rowIds = await rowRepository.listIds(tableId);
  const totalRows = rowIds.length;

  if (totalRows === 0) {
    throw new ValidationError('Table has no rows to enrich');
  }

  // Create the run record
  const columnEnrichment = colMeta.enrichment as any;
  const run = await enrichmentRepository.createRun(tableId, columnName, totalRows, columnEnrichment);

  // Set status to running
  await enrichmentRepository.setRunStatus(run.id, 'running');

  // Build the full config from the column metadata
  const config: EnrichmentConfig = {
    url: columnEnrichment.url || columnEnrichment.url || '',
    method: columnEnrichment.method || 'POST',
    headers: columnEnrichment.headers || {},
    requestTemplate: columnEnrichment.requestTemplate || columnEnrichment.mapping || {},
    responseMapping: columnEnrichment.responseMapping || columnEnrichment.mapping || {},
    outputColumns: columnEnrichment.outputColumns || [],
    maxConcurrency: columnEnrichment.maxConcurrency || columnEnrichment.concurrency || 3,
  };

  processEnrichmentBatch(run.id, tableId, rowIds, config, colMeta.name).catch((err) => {
    logger.error('Enrichment batch failed', err);
  });

  return run;
}

async function processEnrichmentBatch(
  runId: string,
  tableId: string,
  rowIds: string[],
  config: EnrichmentConfig,
  columnName: string
): Promise<void> {
  const maxConcurrency = config.maxConcurrency || 3;
  let completed = 0;
  let failed = 0;

  async function processSingleRow(rowId: string): Promise<void> {
    let requestPayload: Record<string, unknown> = {};
    let responseBody: Record<string, unknown> | null = null;
    let errorMsg: string | null = null;

    try {
      // Get the row data
      const row = await rowRepository.findById(rowId, tableId);
      if (!row) {
        // Row may have been deleted
        await enrichmentRepository.incrementRunProgress(runId);
        completed++;
        return;
      }

      requestPayload = compileTemplate(config.requestTemplate, row.data);
      const apiResponse = await executeApiCall(config, requestPayload);
      responseBody = apiResponse;
      const mapped = mapResponse(apiResponse, config.responseMapping);

      // Write back to row
      if (Object.keys(mapped).length > 0) {
        await rowRepository.patchData(rowId, tableId, mapped);
      }

      await enrichmentRepository.createLog(runId, rowId, 'success', requestPayload, responseBody, null);
      await enrichmentRepository.incrementRunProgress(runId);
      completed++;

      // Emit periodic progress (every 10 rows)
      if (completed % 10 === 0 || completed === rowIds.length) {
        const run = await enrichmentRepository.findRunById(runId);
        if (run) {
          enrichmentEvents.emitProgress({
            type: 'enrichment:progress',
            runId,
            tableId,
            completedRows: completed,
            totalRows: rowIds.length,
            failedRows: failed,
          });
        }
      }
    } catch (error) {
      errorMsg = error instanceof Error ? error.message : 'Unknown error';
      await enrichmentRepository.createLog(runId, rowId, 'error', requestPayload, responseBody, errorMsg);
      await enrichmentRepository.incrementRunFailed(runId);
      failed++;
    }
  }

  // Run with controlled concurrency
  const queue = [...rowIds];
  const workers: Promise<void>[] = [];

  for (let i = 0; i < maxConcurrency; i++) {
    workers.push(
      (async function worker() {
        while (true) {
          const rowId = queue.shift();
          if (!rowId) break;
          await processSingleRow(rowId);
        }
      })()
    );
  }

  await Promise.all(workers);

  // Mark run as completed (or failed if all failed)
  if (failed === rowIds.length) {
    await enrichmentRepository.setRunStatus(runId, 'failed');
  } else {
    await enrichmentRepository.setRunStatus(runId, 'completed');
  }

  // Emit progress events
  enrichmentEvents.emitProgress({
    type: failed === rowIds.length ? 'enrichment:failed' : 'enrichment:completed',
    runId,
    tableId,
    completedRows: completed,
    totalRows: rowIds.length,
    failedRows: failed,
  });

  logger.info(`Enrichment run ${runId} complete: ${completed} success, ${failed} failed`);
}

export async function getRun(runId: string): Promise<EnrichmentRun> {
  const run = await enrichmentRepository.findRunById(runId);
  if (!run) {
    throw new NotFoundError('Enrichment run');
  }
  return run;
}

export async function listRuns(
  tableId: string,
  columnName: string,
  userId: string,
  limit = 20,
  offset = 0
): Promise<{ runs: EnrichmentRun[]; total: number }> {
  await tableService.getTable(tableId, userId);
  return enrichmentRepository.findRunsByColumn(tableId, columnName, limit, offset);
}

export async function getRunLogs(
  runId: string,
  limit = 50,
  offset = 0
): Promise<{ logs: any[]; total: number }> {
  const run = await enrichmentRepository.findRunById(runId);
  if (!run) {
    throw new NotFoundError('Enrichment run');
  }
  return enrichmentRepository.findLogsByRun(runId, limit, offset);
}
