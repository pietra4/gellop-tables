import { FastifyRequest, FastifyReply } from 'fastify';
import { verifyToken } from '../core/auth.js';
import { AuthenticationError } from '../utils/errors.js';

export async function authenticateToken(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError('Missing or invalid authorization header');
    }

    const token = authHeader.slice(7);
    const payload = verifyToken(token);

    (request as any).userId = payload.userId;
    (request as any).username = payload.username;
  } catch (error) {
    throw error instanceof AuthenticationError ? error : new AuthenticationError('Invalid token');
  }
}

export function extractUserId(request: FastifyRequest): string {
  const userId = (request as any).userId;
  if (!userId) {
    throw new AuthenticationError('User not authenticated');
  }
  return userId;
}
