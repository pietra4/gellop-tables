import { FastifyRequest, FastifyReply } from 'fastify';

interface RateLimitStore {
  [key: string]: { count: number; resetAt: number };
}

const store: RateLimitStore = {};

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_REQUESTS = 5;

function getClientIp(request: FastifyRequest): string {
  return (
    (request.headers['x-forwarded-for'] as string)?.split(',')[0] ||
    request.socket.remoteAddress ||
    'unknown'
  );
}

export function rateLimitAuthEndpoints(
  windowMs: number = WINDOW_MS,
  maxRequests: number = MAX_REQUESTS
) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const ip = getClientIp(request);
    const now = Date.now();

    if (!store[ip]) {
      store[ip] = { count: 1, resetAt: now + windowMs };
      return;
    }

    const record = store[ip];

    if (now > record.resetAt) {
      record.count = 1;
      record.resetAt = now + windowMs;
      return;
    }

    record.count++;

    if (record.count > maxRequests) {
      reply.status(429).send({
        error: 'Too many authentication attempts. Try again later.',
        statusCode: 429,
      });
    }
  };
}

// Cleanup old entries every hour
setInterval(() => {
  const now = Date.now();
  Object.keys(store).forEach((key) => {
    if (store[key].resetAt < now) {
      delete store[key];
    }
  });
}, 60 * 60 * 1000);

export default rateLimitAuthEndpoints;
