# Verification Pass — aggiornamento 2026-05-23

## Aggiornamenti verificati (2026-05-23)

Sono state verificate build verdi dopo i cambi Clay-like e formula API.

Backend:
- `npm run build` ✅

Frontend:
- `npm run build` ✅

Note:
- Warning di bundle Glide Data Grid restano non bloccanti (dimensione chunk/commenti pure annotations).

This document records what was **actually executed and verified**, as opposed to
reviewed on paper. An earlier set of review documents (SECURITY.md, BUG_REPORT.md,
UI_REVIEW.md) declared the code "production-ready" with "all tests passing" —
**before any code had ever been installed, compiled, or run.** This pass corrects
that by running everything.

## What Was Run

| Check | Command | Result |
|-------|---------|--------|
| Backend install | `npm install` | ✅ after fixes (3 bad deps) |
| Backend type-check | `tsc --noEmit` | ✅ exit 0 after fixes (8 type errors) |
| Backend startup | `tsx src/app.ts` | ✅ boots, no import errors (DB conn needs Postgres) |
| Backend tests | `npm test` | ✅ 13/13 passing (newly written) |
| Frontend install | `npm install` | ✅ after fix (1 unpublished dep) |
| Frontend type-check | `tsc --noEmit` | ✅ exit 0 after fixes (3 config errors) |
| Frontend build | `vite build` | ✅ exit 0 (192 KB, 64 KB gzip) |

## Blocking Bugs Found & Fixed

These would have made the project **impossible to install or compile**. None were
caught by the earlier paper reviews.

### 1. `fastify-cors@^8.4.2` does not exist
- **Symptom:** `npm install` fails with ETARGET.
- **Cause:** Package was renamed to `@fastify/cors` for Fastify 4.
- **Fix:** Switched dependency to `@fastify/cors@^9.0.1` and updated the import in `app.ts`.

### 2. `glide-data-grid` was unpublished from npm (Nov 2024)
- **Symptom:** Frontend `npm install` fails with ENOVERSIONS.
- **Cause:** Package moved to scope `@glideapps/glide-data-grid`.
- **Fix:** Switched dependency to `@glideapps/glide-data-grid@^6.0.3`.

### 3. `jsonwebtoken@^9.1.2` does not exist + missing `@types/*`
- **Cause:** Latest is 9.0.2; `@types/jsonwebtoken` and `@types/pg` were missing.
- **Fix:** Corrected version, added the missing type packages.

### 4. Top-level `await` with `module: ES2020`
- **Symptom:** 4 TS1378 compile errors in `app.ts`.
- **Fix:** Set `module: ES2022` in `backend/tsconfig.json`.

### 5. `JWT_SECRET` typing + `jwt.verify` cast
- **Symptom:** TS2769 / TS2352 — `string | undefined` not assignable; bad cast.
- **Fix:** `requireJwtSecret()` helper returning `string`; `as unknown as AuthPayload`.

### 6. Frontend tsconfig referenced a non-existent `tsconfig.node.json` + classic module resolution + untyped `import.meta.env`
- **Fix:** Added `moduleResolution: bundler`, removed the dangling reference,
  added `src/vite-env.d.ts` with the Vite client types.

### 7. No tests existed at all
- **Symptom:** `npm test` exited 1 ("No tests found"). The `tests/unit` and
  `tests/integration` folders were empty, and there was no jest config — despite
  documents claiming "8 edge cases tested ✅".
- **Fix:** Added `jest.config.js` (ts-jest ESM) and
  `tests/unit/validation.test.ts` with **13 real, passing tests**. Updated the
  `test` scripts to pass `--experimental-vm-modules`.

## Known Remaining Issues (documented, not hidden)

### npm audit: 7 high-severity advisories (transitive)
- **`fast-uri`** — pulled in by Fastify core (`@fastify/ajv-compiler`,
  `fast-json-stringify`). Fix requires `npm audit fix --force`, which would force a
  breaking change to Fastify. **Decision:** wait for an upstream Fastify patch
  rather than risk breaking the framework. Runtime exposure is in URI routing.
- **`node-tar`** — pulled in by `@mapbox/node-pre-gyp`, a *build-time* dependency
  of `bcrypt` (downloads prebuilt binaries). **Not in the runtime path.** Low real
  risk; revisit when bumping `bcrypt`.

### Integration tests still missing
Unit tests cover validation logic (no DB needed). The following are implemented in
code but **not yet tested** because they need a running Postgres + HTTP-level
(supertest) tests: register conflict (409), login failure (401), token middleware
(401), rate limiting (429). These are the first task for Phase 2.

### Backend startup not fully verified
The app boots and registers routes with no import errors, but a full
request/response cycle was not verified because no Postgres instance was running in
this environment. Verifying with `docker-compose up` is recommended next.

## Honest Status

- **Compiles:** ✅ backend and frontend, exit 0.
- **Builds:** ✅ frontend production bundle.
- **Tests:** ✅ 13 unit tests passing (real). ⚠️ no integration/e2e yet.
- **Runs end-to-end:** ⚠️ not yet verified against a live database.
- **Security:** mitigations in code are real (parameterized queries, rate limit,
  CSP, bcrypt), but were not penetration-tested against a running instance.

**Bottom line:** the project now genuinely installs, compiles, and has a passing
test suite — which was *not* true before this pass. It is a sound Phase-1 base, but
it has not yet been run against a real database, and integration tests remain to be
written.
