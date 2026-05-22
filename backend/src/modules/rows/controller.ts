import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import * as rowService from './service.js';
import { extractUserId } from '../../middleware/auth.js';
import { CreateRowSchema, UpdateRowSchema } from '../../core/validation.js';
import { ValidationError } from '../../utils/errors.js';

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

const RowQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(rowService.MAX_PAGE_SIZE).default(rowService.DEFAULT_PAGE_SIZE),
  offset: z.coerce.number().int().min(0).default(0),
  sort: z.string().optional(),
  dir: z.enum(['asc', 'desc']).optional(),
  // Filters passed as filter[col]=value, captured generically via the wildcard below
});

export async function createRowHandler(request: FastifyRequest, reply: FastifyReply) {
  const userId = extractUserId(request);
  const { id: tableId } = request.params as { id: string };
  const input = parse(CreateRowSchema, request.body);
  const row = await rowService.createRow(tableId, userId, input.data ?? {});
  reply.status(201).send(row);
}

export async function listRowsHandler(request: FastifyRequest, reply: FastifyReply) {
  const userId = extractUserId(request);
  const { id: tableId } = request.params as { id: string };
  const { limit, offset, sort, dir } = parse(RowQuerySchema, request.query);

  // Extract filter params (filter[name]=value)
  const filters: Record<string, string> = {};
  const query = request.query as Record<string, string>;
  for (const [key, value] of Object.entries(query)) {
    const match = key.match(/^filter\[(.+)\]$/);
    if (match && value) {
      filters[match[1]] = value;
    }
  }

  const result = await rowService.listRows(tableId, userId, { limit, offset, sort, dir, filters });
  reply.send(result);
}

export async function getRowHandler(request: FastifyRequest, reply: FastifyReply) {
  const userId = extractUserId(request);
  const { id: tableId, rowId } = request.params as { id: string; rowId: string };
  const row = await rowService.getRow(rowId, tableId, userId);
  reply.send(row);
}

export async function updateRowHandler(request: FastifyRequest, reply: FastifyReply) {
  const userId = extractUserId(request);
  const { id: tableId, rowId } = request.params as { id: string; rowId: string };
  const input = parse(UpdateRowSchema, request.body);
  const row = await rowService.updateRow(rowId, tableId, userId, input.data);
  reply.send(row);
}

export async function deleteRowHandler(request: FastifyRequest, reply: FastifyReply) {
  const userId = extractUserId(request);
  const { id: tableId, rowId } = request.params as { id: string; rowId: string };
  await rowService.deleteRow(rowId, tableId, userId);
  reply.status(204).send();
}

export async function importCsvHandler(request: FastifyRequest, reply: FastifyReply) {
  const userId = extractUserId(request);
  const { id: tableId } = request.params as { id: string };

  const body = request.body;
  const csvContent = typeof body === 'string' ? body : (body as { content?: string })?.content;

  if (typeof csvContent !== 'string' || csvContent.trim() === '') {
    throw new ValidationError('Request body must be CSV text (text/csv) or { content: "<csv>" }');
  }

  const result = await rowService.importCsv(tableId, userId, csvContent);
  reply.status(201).send(result);
}
