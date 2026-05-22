import Fastify from 'fastify';
import fastifyCors from 'fastify-cors';
import { initializeDatabase, closeDatabase } from './core/database.js';
import { errorHandler } from './middleware/errorHandler.js';
import { userRoutes } from './modules/users/routes.js';
import logger from './utils/logger.js';

const app = Fastify({
  logger: false,
  bodyLimit: 1048576,
});

const PORT = parseInt(process.env.API_PORT || '3000', 10);
const HOST = process.env.API_HOST || '0.0.0.0';
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';

// Register plugins
await app.register(fastifyCors, {
  origin: CORS_ORIGIN,
  credentials: true,
});

// Error handler
app.setErrorHandler(errorHandler);

// Routes
await userRoutes(app);

// Health check
app.get('/health', async () => ({ status: 'ok' }));

// Initialize database and start server
try {
  await initializeDatabase();
  await app.listen({ port: PORT, host: HOST });
  logger.info(`Server running at http://${HOST}:${PORT}`);
} catch (error) {
  logger.error('Server startup error', error);
  process.exit(1);
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await app.close();
  await closeDatabase();
  process.exit(0);
});

export default app;
