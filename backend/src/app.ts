import Fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyWebsocket from '@fastify/websocket';
import { initializeDatabase, closeDatabase } from './core/database.js';
import { errorHandler } from './middleware/errorHandler.js';
import { addSecurityHeaders } from './middleware/securityHeaders.js';
import { userRoutes } from './modules/users/routes.js';
import { tableRoutes } from './modules/tables/routes.js';
import { rowRoutes } from './modules/rows/routes.js';
import { enrichmentRoutes } from './modules/enrichment/routes.js';
import { enrichmentEvents } from './modules/enrichment/events.js';
import { webhookRoutes } from './modules/webhooks/routes.js';
import getWsBroadcast from './utils/websocket.js';
import logger from './utils/logger.js';

const app = Fastify({
  logger: false,
  bodyLimit: 1048576,
});

// Accept raw CSV uploads (text/csv) as a string body for the import endpoint.
app.addContentTypeParser(
  'text/csv',
  { parseAs: 'string', bodyLimit: 64 * 1024 * 1024 },
  (_req, body, done) => done(null, body)
);

const PORT = parseInt(process.env.API_PORT || '3000', 10);
const HOST = process.env.API_HOST || '0.0.0.0';
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';

// Register plugins
await app.register(fastifyCors, {
  origin: CORS_ORIGIN,
  credentials: true,
});

// WebSocket for real-time updates
await app.register(fastifyWebsocket);

app.register(async function (fastify) {
  fastify.get('/ws', { websocket: true }, (socket, req) => {
    socket.on('message', (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'subscribe' && msg.tableId) {
          socket.tableId = msg.tableId;
          socket.send(JSON.stringify({ type: 'subscribed', tableId: msg.tableId }));
        }
      } catch {
        // ignore malformed messages
      }
    });

    socket.on('close', () => {
      // Cleanup handled by GC
    });
  });
});

// Error handler
app.setErrorHandler(errorHandler);

// Security headers on all responses
app.addHook('onSend', async (request, reply) => {
  addSecurityHeaders(reply);
});

// Routes
await userRoutes(app);
await tableRoutes(app);
await rowRoutes(app);
await enrichmentRoutes(app);
await webhookRoutes(app);

// Health check
app.get('/health', async () => ({ status: 'ok' }));

// Wire enrichment events to WS broadcast after server is ready
const ws = getWsBroadcast(app);
enrichmentEvents.on('enrichment:progress', (event) => {
  ws.broadcast(event.tableId, event);
});
enrichmentEvents.on('enrichment:completed', (event) => {
  ws.broadcast(event.tableId, event);
});
enrichmentEvents.on('enrichment:failed', (event) => {
  ws.broadcast(event.tableId, event);
});

// Initialize database and start server, unless imported for testing.
const isMainModule = process.env.NODE_ENV !== 'test';
if (isMainModule) {
  try {
    await initializeDatabase();
    await app.listen({ port: PORT, host: HOST });
    logger.info(`Server running at http://${HOST}:${PORT}`);
  } catch (error) {
    logger.error('Server startup error', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await app.close();
  await closeDatabase();
  process.exit(0);
});

export default app;
