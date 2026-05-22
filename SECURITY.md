# Security Policy & Checklist

## Implemented Protections

### Authentication & Passwords
- ✅ bcrypt 10-rounds for password hashing (timing attack resistant)
- ✅ JWT with 24h expiry (configurable)
- ✅ Generic error messages ("Invalid username or password" — doesn't leak if user exists)
- ✅ Password complexity: min 12 chars, letters + numbers + special characters
- ✅ JWT_SECRET required at startup (fails if not in .env)

### API Security
- ✅ All endpoints use parameterized queries (SQL injection prevention)
- ✅ User isolation: every query filters by user_id
- ✅ Input validation with Zod on all endpoints
- ✅ Rate limiting on auth endpoints (5 attempts / 15 min per IP)
- ✅ Bearer token authentication pattern
- ✅ Error handler that doesn't expose stack traces

### Frontend Security
- ✅ React auto-escapes content (XSS protection)
- ✅ JWT in localStorage with interceptors
- ✅ 401 → automatic logout + redirect
- ✅ Content Security Policy headers
- ✅ X-Frame-Options: DENY (clickjacking prevention)
- ✅ X-Content-Type-Options: nosniff (MIME sniffing prevention)

### Database
- ✅ JSONB schema flexible but secure
- ✅ Foreign key constraints with CASCADE delete
- ✅ Connection pooling with error handling
- ✅ UUID primary keys (no sequential IDs)

---

## Known Limitations & Mitigations

### JWT in localStorage
**Risk:** Vulnerable to XSS if CSP not enforced  
**Mitigation:** CSP headers enabled, Content-Security-Policy set to restrict script sources  
**Future:** Consider httpOnly cookies + CSRF tokens for higher security

### Basic Rate Limiting
**Risk:** In-memory store, doesn't scale across multiple processes  
**Mitigation:** OK for MVP. For production, use Redis-backed rate limiting  
**Future:** Implement with Redis when deployed on multiple machines

### No HTTPS Enforcement
**Risk:** Tokens sent in plaintext over HTTP  
**Mitigation:** Develop locally on localhost, production enforces HTTPS via Cloudflare Tunnel  
**Future:** Add HSTS headers, HTTPS redirect

### Row Data Validation
**Risk:** `z.record(z.any())` accepts any data structure  
**Mitigation:** OK for MVP (columns not yet strongly typed)  
**Future:** Add per-column schema validation when adding enrichment/formulas

---

## Pre-Production Checklist

Before deploying to production:

- [ ] Set strong JWT_SECRET (use `openssl rand -hex 32`)
- [ ] Enable HTTPS everywhere (Cloudflare Tunnel handles this)
- [ ] Rotate JWT_SECRET regularly (implement key rotation if possible)
- [ ] Set up monitoring/alerting for auth failures
- [ ] Enable PostgreSQL connection encryption (SSL)
- [ ] Use strong database password (not `clayite_dev_pass`)
- [ ] Set NODE_ENV=production
- [ ] Enable HSTS (Strict-Transport-Security)
- [ ] Set up rate limiting in reverse proxy (Cloudflare)
- [ ] Log security events (auth, enrichment jobs, errors)
- [ ] Regular SQL injection testing
- [ ] Regular XSS testing (especially CSV import once added)
- [ ] Penetration test before launch

---

## Common Security Patterns

### Always Use Parameterized Queries
```typescript
// WRONG
const result = await query(`SELECT * FROM users WHERE id = '${userId}'`);

// RIGHT
const result = await query('SELECT * FROM users WHERE id = $1', [userId]);
```

### Always Filter by User ID
```typescript
// WRONG
const tables = await query('SELECT * FROM tables WHERE id = $1', [tableId]);

// RIGHT
const tables = await query('SELECT * FROM tables WHERE id = $1 AND user_id = $2', [tableId, userId]);
```

### Always Validate Input
```typescript
// WRONG
const name = req.body.name;

// RIGHT
const { name } = CreateTableSchema.parse(req.body); // throws if invalid
```

### Never Expose Secrets
```typescript
// WRONG
logger.info(`JWT_SECRET: ${JWT_SECRET}`);
logger.error(`Auth failed for user: ${username}`); // leaks username in logs

// RIGHT
logger.info('Auth startup complete');
logger.error('Authentication failed'); // generic
```

---

## Sensitive Information

Never commit or log:
- API keys / tokens
- Database passwords
- JWT secrets
- Private keys
- User emails (in logs)
- Password hashes (in logs)

Use `.env` files (git-ignored) for all secrets.

---

## Reporting Security Issues

If you discover a vulnerability:
1. Do NOT publish it publicly
2. Contact the maintainer privately
3. Include: description, impact, reproduction steps, proposed fix
4. Allow 90 days for patch before disclosure

---

## References

- OWASP Top 10: https://owasp.org/Top10/
- JWT Best Practices: https://tools.ietf.org/html/rfc8725
- NIST Password Guidelines: https://pages.nist.gov/800-63-3/sp800-63b.html
- Fastify Security: https://www.fastify.io/docs/latest/Guides/Security/
