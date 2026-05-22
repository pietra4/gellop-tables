import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import * as enrichmentService from './service.js';
import { extractUserId } from '../../middleware/auth.js';
import { ValidationError } from '../../utils/errors.js';

const StartEnrichmentSchema = z.object({
  columnName: z.string().min(1),
});

const PaginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

function parse<T>(schema: { parse: (v: unknown) => T }, body: unknown): T {
  try {
    return schema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError('Invalid input: ' + error.errors[0].message);
    }
    throw error;
  }
}

export async function startEnrichmentHandler(request: FastifyRequest, reply: FastifyReply) {
  const userId = extractUserId(request);
  const { id: tableId } = request.params as { id: string };
  const { columnName } = parse(StartEnrichmentSchema, request.body);
  const run = await enrichmentService.startEnrichment(tableId, userId, columnName);
  reply.status(201).send(run);
}

export async function getRunHandler(request: FastifyRequest, reply: FastifyReply) {
  const { runId } = request.params as { runId: string };
  const run = await enrichmentService.getRun(runId);
  reply.send(run);
}

export async function listRunsHandler(request: FastifyRequest, reply: FastifyReply) {
  const userId = extractUserId(request);
  const { id: tableId } = request.params as { id: string };
  const { columnName } = request.query as { columnName?: string };
  const { limit, offset } = parse(PaginationSchema, request.query);

  if (!columnName) {
    throw new ValidationError('columnName query parameter is required');
  }

  const result = await enrichmentService.listRuns(tableId, columnName, userId, limit, offset);
  reply.send(result);
}

export async function getRunLogsHandler(request: FastifyRequest, reply: FastifyReply) {
  const { runId } = request.params as { runId: string };
  const { limit, offset } = parse(PaginationSchema, request.query);
  const result = await enrichmentService.getRunLogs(runId, limit, offset);
  reply.send(result);
}
