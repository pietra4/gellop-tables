import { FastifyReply } from 'fastify';

export function addSecurityHeaders(reply: FastifyReply): void {
  // Content Security Policy: prevent XSS
  reply.header(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'"
  );

  // Prevent clickjacking
  reply.header('X-Frame-Options', 'DENY');

  // Prevent MIME sniffing
  reply.header('X-Content-Type-Options', 'nosniff');

  // Enable XSS protection (legacy)
  reply.header('X-XSS-Protection', '1; mode=block');

  // No referrer policy
  reply.header('Referrer-Policy', 'no-referrer');

  // Strict Transport Security (only for HTTPS)
  if (process.env.NODE_ENV === 'production') {
    reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
}
