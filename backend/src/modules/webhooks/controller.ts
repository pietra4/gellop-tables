import { FastifyRequest, FastifyReply } from 'fastify';
import { query } from '../../core/database.js';
import * as webhookRepository from './repository.js';
import * as rowService from '../rows/service.js';
import * as tableService from '../tables/service.js';
import { extractUserId } from '../../middleware/auth.js';
import { ValidationError } from '../../utils/errors.js';

export async function createWebhookHandler(request: FastifyRequest, reply: FastifyReply) {
  const userId = extractUserId(request);
  const { id: tableId } = request.params as { id: string };

  await tableService.getTable(tableId, userId);
  const token = await webhookRepository.createToken(tableId);
  reply.status(201).send({ token, webhookUrl: `/api/webhooks/${tableId}?token=${token}` });
}

export async function listWebhooksHandler(request: FastifyRequest, reply: FastifyReply) {
  const userId = extractUserId(request);
  const { id: tableId } = request.params as { id: string };
  await tableService.getTable(tableId, userId);

  const tokens = await webhookRepository.listTokens(tableId);
  reply.send({
    webhooks: tokens.map((t) => ({
      token: t,
      url: `/api/webhooks/${tableId}?token=${t}`,
    })),
  });
}

export async function revokeWebhookHandler(request: FastifyRequest, reply: FastifyReply) {
  const userId = extractUserId(request);
  const { id: tableId, tokenId } = request.params as { id: string; tokenId: string };
  await tableService.getTable(tableId, userId);

  await webhookRepository.revokeToken(tableId, tokenId);
  reply.status(204).send();
}

export async function webhookReceiveHandler(request: FastifyRequest, reply: FastifyReply) {
  const { tableId } = request.params as { tableId: string };
  const queryToken = (request.query as { token?: string }).token;

  if (!queryToken) {
    reply.status(401).send({ error: 'Missing webhook token' });
    return;
  }

  const foundTableId = await webhookRepository.findTableByToken(queryToken);
  if (!foundTableId || foundTableId !== tableId) {
    reply.status(401).send({ error: 'Invalid webhook token' });
    return;
  }

  const body = request.body as Record<string, unknown>;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ValidationError('Webhook body must be a JSON object');
  }

  const tableResult = await query(
    'SELECT user_id FROM tables WHERE id = $1',
    [tableId]
  );
  if (tableResult.rows.length === 0) {
    reply.status(404).send({ error: 'Table not found' });
    return;
  }
  const userId = tableResult.rows[0].user_id;

  const row = await rowService.createRow(tableId, userId, body);
  reply.status(201).send(row);
}
