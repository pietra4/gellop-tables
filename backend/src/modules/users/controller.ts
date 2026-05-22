import { FastifyRequest, FastifyReply } from 'fastify';
import { register, login, getUser } from '../../core/auth.js';
import { RegisterSchema, LoginSchema } from '../../core/validation.js';
import { extractUserId } from '../../middleware/auth.js';
import { ValidationError } from '../../utils/errors.js';

export async function registerHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const input = RegisterSchema.parse(request.body);
    const result = await register(input);

    reply.status(201).send({
      userId: result.userId,
      token: result.token,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      throw new ValidationError('Invalid input');
    }
    throw error;
  }
}

export async function loginHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const input = LoginSchema.parse(request.body);
    const result = await login(input);

    reply.send({
      userId: result.userId,
      username: result.username,
      token: result.token,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      throw new ValidationError('Invalid input');
    }
    throw error;
  }
}

export async function meHandler(request: FastifyRequest, reply: FastifyReply) {
  const userId = extractUserId(request);
  const user = await getUser(userId);

  reply.send(user);
}
