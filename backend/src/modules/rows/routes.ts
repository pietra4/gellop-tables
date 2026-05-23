import { exportCsvHandler } from './exportController.js';
import {
  createRowHandler,
  listRowsHandler,
  getRowHandler,
  updateRowHandler,
  deleteRowHandler,
  importCsvHandler,
  runFormulaHandler,
} from './controller.js';
import { authenticateToken } from '../../middleware/auth.js';
import { FastifyInstance } from 'fastify';

/** 64 MB upload ceiling for CSV import (≈100k rows of typical width). */
const CSV_BODY_LIMIT = 64 * 1024 * 1024;

export async function rowRoutes(app: FastifyInstance) {
  app.post('/tables/:id/rows', { preHandler: authenticateToken }, createRowHandler);
  app.post('/tables/:id/formula/run', { preHandler: authenticateToken }, runFormulaHandler);
  app.get('/tables/:id/rows', { preHandler: authenticateToken }, listRowsHandler);
  app.get('/tables/:id/rows/:rowId', { preHandler: authenticateToken }, getRowHandler);
  app.patch('/tables/:id/rows/:rowId', { preHandler: authenticateToken }, updateRowHandler);
  app.delete('/tables/:id/rows/:rowId', { preHandler: authenticateToken }, deleteRowHandler);

  app.post(
    '/tables/:id/import',
    { preHandler: authenticateToken, bodyLimit: CSV_BODY_LIMIT },
    importCsvHandler
  );

  app.get(
    '/tables/:id/export',
    { preHandler: authenticateToken },
    exportCsvHandler
  );
}
