import { FastifyInstance } from 'fastify';
import { authenticateToken } from '../../middleware/auth.js';
import {
  createTableHandler,
  listTablesHandler,
  getTableHandler,
  updateTableHandler,
  deleteTableHandler,
  addColumnHandler,
  deleteColumnHandler,
} from './controller.js';

export async function tableRoutes(app: FastifyInstance) {
  app.post('/tables', { preHandler: authenticateToken }, createTableHandler);
  app.get('/tables', { preHandler: authenticateToken }, listTablesHandler);
  app.get('/tables/:id', { preHandler: authenticateToken }, getTableHandler);
  app.patch('/tables/:id', { preHandler: authenticateToken }, updateTableHandler);
  app.delete('/tables/:id', { preHandler: authenticateToken }, deleteTableHandler);

  app.post('/tables/:id/columns', { preHandler: authenticateToken }, addColumnHandler);
  app.delete('/tables/:id/columns/:name', { preHandler: authenticateToken }, deleteColumnHandler);
}
