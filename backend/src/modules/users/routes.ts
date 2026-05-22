import { FastifyInstance } from 'fastify';
import { registerHandler, loginHandler, meHandler } from './controller.js';
import { authenticateToken } from '../../middleware/auth.js';
import rateLimitAuthEndpoints from '../../middleware/rateLimiter.js';

export async function userRoutes(app: FastifyInstance) {
  app.post('/auth/register', { preHandler: rateLimitAuthEndpoints() }, registerHandler);
  app.post('/auth/login', { preHandler: rateLimitAuthEndpoints() }, loginHandler);

  app.get('/auth/me', { preHandler: authenticateToken }, meHandler);
}
