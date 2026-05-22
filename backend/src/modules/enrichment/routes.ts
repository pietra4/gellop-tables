import { FastifyInstance } from 'fastify';
import { authenticateToken } from '../../middleware/auth.js';
import {
  startEnrichmentHandler,
  getRunHandler,
  listRunsHandler,
  getRunLogsHandler,
} from './controller.js';

export async function enrichmentRoutes(app: FastifyInstance) {
  app.post('/tables/:id/enrich', { preHandler: authenticateToken }, startEnrichmentHandler);
  app.get('/tables/:id/enrich/runs/:runId', { preHandler: authenticateToken }, getRunHandler);
  app.get('/tables/:id/enrich/runs', { preHandler: authenticateToken }, listRunsHandler);
  app.get('/tables/:id/enrich/runs/:runId/logs', { preHandler: authenticateToken }, getRunLogsHandler);
}
