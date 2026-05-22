import { FastifyInstance } from 'fastify';
import { authenticateToken } from '../../middleware/auth.js';
import {
  createWebhookHandler,
  listWebhooksHandler,
  revokeWebhookHandler,
  webhookReceiveHandler,
} from './controller.js';

export async function webhookRoutes(app: FastifyInstance) {
  // Admin endpoints (JWT auth)
  app.post('/tables/:id/webhooks', { preHandler: authenticateToken }, createWebhookHandler);
  app.get('/tables/:id/webhooks', { preHandler: authenticateToken }, listWebhooksHandler);
  app.delete('/tables/:id/webhooks/:tokenId', { preHandler: authenticateToken }, revokeWebhookHandler);

  // Public webhook receive (token auth)
  app.post('/api/webhooks/:tableId', webhookReceiveHandler);
}
