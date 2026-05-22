import { FastifyRequest, FastifyReply } from 'fastify';
import * as rowService from './service.js';
import { extractUserId } from '../../middleware/auth.js';
import { ValidationError } from '../../utils/errors.js';

export async function exportCsvHandler(request: FastifyRequest, reply: FastifyReply) {
  const userId = extractUserId(request);
  const { id: tableId } = request.params as { id: string };
  const csv = await rowService.exportCsv(tableId, userId);
  reply.header('Content-Type', 'text/csv');
  reply.header('Content-Disposition', `attachment; filename="table-${tableId}.csv"`);
  reply.send(csv);
}
