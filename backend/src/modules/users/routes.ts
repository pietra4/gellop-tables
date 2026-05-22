import { FastifyInstance } from 'fastify';
import { registerHandler, loginHandler, meHandler } from './controller.js';
import { authenticateToken } from '../../middleware/auth.js';

export async function userRoutes(app: FastifyInstance) {
  app.post('/auth/register', registerHandler);
  app.post('/auth/login', loginHandler);

  app.get('/auth/me', { preHandler: authenticateToken }, meHandler);
}
