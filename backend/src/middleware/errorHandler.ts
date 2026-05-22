import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '../utils/errors.js';
import logger from '../utils/logger.js';

export async function errorHandler(
  error: FastifyError | AppError | Error,
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  if (error instanceof AppError) {
    logger.warn(`${error.statusCode} - ${error.message}`);
    reply.status(error.statusCode).send({
      error: error.message,
      statusCode: error.statusCode,
    });
  } else {
    logger.error('Unhandled error', error);
    reply.status(500).send({
      error: 'Internal server error',
      statusCode: 500,
    });
  }
}
