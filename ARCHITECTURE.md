# Clay-lite Platform — Documento Architetturale

**Versione:** 1.0  
**Data:** 2026-05-22  
**Stato:** Proposta (in attesa di approvazione)

---

## 1. Visione e Requisiti

**Obiettivo:** Piattaforma self-hosted di gestione dati tipo Clay, focalizzata solo sulla tabella interattiva.

**Requisiti Funzionali**
- Importare CSV e trasformarlo in tabella
- Aggiungere/rimuovere colonne
- Colonne di "enrichment" che chiamano API esterne basate su valori di altre colonne
- Parsing e distribuzione della risposta JSON su più colonne
- Formule potenti (stile Clay: IF, CONCAT, aggregazioni, date, logiche complesse)
- Filtri interattivi
- Aggiunta righe via webhook da sistemi esterni
- Multi-utente (login credenziali, no ruoli per ora)
- Supporto 25k–100k righe senza lag

**Requisiti Non-Funzionali**
- Deployment: Docker su Raspberry Pi (16GB RAM, 4 core)
- Accesso esterno: Raspberry + Cloudflare Tunnel (HTTPS, zero porte aperte)
- Security-first: validazione input, protezione injection, API endpoints sicuri
- Modulare e scalabile: facile aggiungere feature dopo
- Documentazione intermedia per ripresa sviluppo da sessioni successive
- Comprehensive testing (unit, integration, e2e)
- Codice seguendo best practice moderne (TypeScript strict, linting, error handling)

---

## 2. Scelte Tecniche

### 2.1 Database: PostgreSQL

**Perché:**
- JSONB type perfetto per righe flessibili (colonne dinamiche, no migrazioni schema)
- Potent indexing e query performance anche con 100k righe
- Supported nativamente in Docker (immagine ufficiale Postgres)
- Job queue (pg-boss) usa Postgres, riduce servizi in Docker

**Schema di Alto Livello**
```
tables
├── id (UUID)
├── user_id (FK)
├── name
├── columns_metadata (JSONB) — lista colonne, loro tipi, config enrichment
├── created_at, updated_at

rows
├── id (UUID)
├── table_id (FK)
├── data (JSONB) — row data: {col_name: value, ...}
├── created_at, updated_at

jobs (pg-boss)
├── id
├── table_id, row_id, column_id
├── state (created, running, completed, failed)
├── result (JSONB della risposta API)
├── retry_count, next_retry_at
```

**Indexing Strategy**
- (table_id, user_id) on rows per query isolation
- GIN index su columns_metadata per search config
- pg-boss self-managed (built-in indexing)

### 2.2 Backend: Node.js + TypeScript + Fastify

**Perché:**
- TypeScript strict mode → type safety, fewer bugs
- Fastify: ultra-lightweight, good for ARM (Raspberry Pi)
- Ecosystem: pg (database), pg-boss (queue), zod (validation), jsonschema (formulas)

**Architettura Modulare**

```
backend/
├── src/
│   ├── core/
│   │   ├── database.ts — Postgres pool, migrations
│   │   ├── auth.ts — JWT, bcrypt password hashing
│   │   ├── validation.ts — Zod schemas for inputs
│   │
│   ├── modules/
│   │   ├── tables/
│   │   │   ├── controller.ts — HTTP endpoints
│   │   │   ├── service.ts — Business logic (import CSV, add/remove cols)
│   │   │   ├── repository.ts — DB queries
│   │   │   └── types.ts
│   │   │
│   │   ├── rows/
│   │   │   ├── controller.ts
│   │   │   ├── service.ts
│   │   │   ├── repository.ts
│   │   │   └── types.ts
│   │   │
│   │   ├── enrichment/
│   │   │   ├── controller.ts — Start enrichment jobs
│   │   │   ├── service.ts — Orchestrate API calls, parse responses
│   │   │   ├── queue.ts — pg-boss integration
│   │   │   ├── worker.ts — Background job processor
│   │   │   └── types.ts
│   │   │
│   │   ├── formulas/
│   │   │   ├── parser.ts — Parse formula strings
│   │   │   ├── executor.ts — Evaluate formulas given row context
│   │   │   ├── functions.ts — IF, CONCAT, date, aggregations, etc.
│   │   │   └── types.ts
│   │   │
│   │   ├── webhooks/
│   │   │   ├── controller.ts — POST /webhooks/:table_id/:token
│   │   │   ├── service.ts
│   │   │   └── types.ts
│   │   │
│   │   └── users/
│   │       ├── controller.ts — Login, register (optional)
│   │       ├── service.ts
│   │       └── repository.ts
│   │
│   ├── middleware/
│   │   ├── auth.ts — Verify JWT token
│   │   ├── errorHandler.ts — Global error handling + logging
│   │   └── requestLogger.ts
│   │
│   ├── utils/
│   │   ├── logger.ts — Structured logging
│   │   ├── errors.ts — Custom error classes
│   │   └── crypto.ts — Hashing utilities
│   │
│   └── app.ts — Fastify setup, route registration
│
├── migrations/ — SQL migration files (Postgres)
├── tests/
│   ├── unit/ — Service, parser, executor logic
│   ├── integration/ — DB + services together
│   └── e2e/ — Full flow (import CSV, enrichment, formula eval)
│
├── docker-compose.yml
├── Dockerfile
├── .env.example
├── package.json
└── tsconfig.json
```

**API Endpoints (Overview)**
```
POST /auth/register
POST /auth/login
GET /auth/me

POST /tables — Create table
GET /tables — List user's tables
GET /tables/:id — Get table + schema
PUT /tables/:id — Update table name
DELETE /tables/:id

POST /tables/:id/import — Import CSV
POST /tables/:id/rows — Add row(s)
GET /tables/:id/rows — List rows (paginated, with filters)
PUT /tables/:id/rows/:row_id — Update row
DELETE /tables/:id/rows/:row_id

PATCH /tables/:id/columns/:col_id — Update column config (enrichment settings)
POST /tables/:id/columns/:col_id/enrich — Start enrichment for a column

GET /tables/:id/jobs — List enrichment jobs + status
GET /tables/:id/jobs/:job_id — Job detail + result

POST /webhooks/:table_id/:auth_token — Add rows via webhook
```

**Security Measures**
- Password hashing: bcrypt (10 rounds)
- JWT: HS256, 24h expiry
- CORS: only frontend origin
- Rate limiting: 100 req/min per IP (to prevent abuse)
- Input validation: Zod schemas on all endpoints
- SQL injection: parameterized queries via pg library
- XSS: sanitize CSV imports, escape JSON responses
- CSRF: not needed (API tokens instead of cookies, but consider for UI)
- Webhook auth: table_id + random token (regenerate per table)
- User isolation: all queries filter by user_id
- Logging: structured logs (errors, auth, enrichment jobs) for debugging

### 2.3 Frontend: React + Data Grid (Glide Data Grid)

**Perché Glide Data Grid:**
- Canvas-based rendering → handles 100k rows senza lag
- Clay-like UX (column headers, inline editing, cell selection)
- Lightweight, buono per Raspberry (bassissimo overhead)
- Free community edition

**Architettura Modulare**

```
frontend/
├── src/
│   ├── components/
│   │   ├── Layout.tsx — Header, sidebar, main
│   │   ├── TableViewer.tsx — Grid + row operations
│   │   ├── ColumnConfig.tsx — Add/edit/delete columns
│   │   ├── EnrichmentSetup.tsx — Configure API enrichment
│   │   ├── FormulaEditor.tsx — Write formulas
│   │   ├── FilterPanel.tsx — Interactive filtering
│   │   ├── JobStatus.tsx — Enrichment job progress
│   │   ├── CSVImport.tsx — Upload + map columns
│   │   └── LoginForm.tsx
│   │
│   ├── hooks/
│   │   ├── useAuth.ts — Login/logout, JWT storage
│   │   ├── useTable.ts — Fetch table + rows
│   │   ├── useEnrichment.ts — Start jobs, poll status
│   │   └── useFormula.ts — Evaluate formulas in UI
│   │
│   ├── api/
│   │   ├── client.ts — Axios instance with auth header
│   │   ├── tables.ts — Table API calls
│   │   ├── rows.ts — Row CRUD
│   │   ├── enrichment.ts — Job API calls
│   │   └── users.ts — Auth
│   │
│   ├── types/
│   │   ├── index.ts — Shared types (Table, Row, Column, Job)
│   │
│   ├── utils/
│   │   ├── storage.ts — localStorage for JWT
│   │   ├── date.ts — Date formatting
│   │   └── csv.ts — Parse/export CSV
│   │
│   ├── App.tsx
│   └── index.tsx
│
├── package.json
└── vite.config.ts (or webpack)
```

**Key Features**
- Real-time table view with pagination (20 rows at a time, virtual scroll)
- Inline cell editing (calls PUT /rows/:id)
- Add/remove rows (buttons + webhook preview)
- Column management (add, type, enrichment config, formulas)
- Job progress: sidebar showing running enrichments
- Filters: dropdown per column, saved presets
- CSV export

**Auth Flow**
- Login page: username + password → POST /auth/login → JWT in localStorage
- API calls: attach Authorization: Bearer <token>
- On 401: clear token, redirect to login

### 2.4 Deployment: Docker + Cloudflare Tunnel

**docker-compose.yml**
```
services:
  postgres:
    image: postgres:16-alpine
    volumes: [postgres_data:/var/lib/postgresql/data]
    environment: {POSTGRES_PASSWORD: <secret>, POSTGRES_DB: clayite}
    ports: ["5432:5432"]  # internal only

  backend:
    build: ./backend
    depends_on: [postgres]
    environment:
      DATABASE_URL: postgresql://postgres:<secret>@postgres:5432/clayite
      JWT_SECRET: <secret>
      NODE_ENV: production
    ports: ["3000:3000"]

  frontend:
    build: ./frontend
    depends_on: [backend]
    environment:
      VITE_API_URL: http://localhost:3000
    ports: ["5173:5173"]

  cloudflare-tunnel:
    image: cloudflare/cloudflared:latest
    command: tunnel --no-autoupdate run --token <CF-TOKEN>
    # Cloudflare tunnel runs on Raspberry externally
    # No port forwarding needed on router
```

**Accesso Esterno**
1. User crea tunnel in Cloudflare dashboard, genera token
2. Token iniettato in env del container
3. Cloudflare tunnel espone `backend:3000` e `frontend:5173` tramite Cloudflare HTTPS
4. Browser accede `https://<subdomain>.cloudflare.app`
5. Zero porte aperte sul Raspberry

**Backup & Persistence**
- Postgres data volume persiste tra restarts
- Weekly dumps a file (crontab script) per disaster recovery
- Env secrets in `.env.local` (non committato)

---

## 3. Piano di Sviluppo (Fasi)

### Fase 1: Setup Base (1-2 sessioni)
- [ ] Repo + gitignore
- [ ] docker-compose.yml (Postgres, Node skeleton)
- [ ] Migrations SQL (schema tables, rows, jobs)
- [ ] Auth backend (register, login, JWT middleware)
- [ ] Login frontend (form, token storage)
- [ ] Tests: auth flow

### Fase 2: Table & Rows (1-2 sessioni)
- [ ] CRUD tabelle (create, list, get, delete)
- [ ] CRUD righe (add, edit, delete, list paginated)
- [ ] CSV import (parser, map colonne, insert rows)
- [ ] Frontend: table viewer con Glide Data Grid
- [ ] Tests: table import, row operations

### Fase 3: Enrichment (2-3 sessioni)
- [ ] pg-boss queue setup
- [ ] Enrichment service: call API, parse JSON
- [ ] Job status tracking UI
- [ ] Configurazione per colonna: URL template, rate limit, retry
- [ ] Frontend: enrichment config form + job progress sidebar
- [ ] Tests: API mock, job queue, parsing

### Fase 4: Formule (2 sessioni)
- [ ] Parser (tokenizer, AST builder)
- [ ] Executor (eval formula con row context)
- [ ] Function library (IF, CONCAT, UPPER, date, MIN/MAX, etc.)
- [ ] Frontend: formula editor con autocomplete
- [ ] Tests: parser edge cases, executor logic

### Fase 5: Filtri & Webhooks (1-2 sessioni)
- [ ] Filter logic (comparisons, AND/OR)
- [ ] Webhook endpoint con token auth
- [ ] Webhook test UI + logs
- [ ] Tests: filtering, webhook security

### Fase 6: Polish & Deploy (1 sessione)
- [ ] Error handling completo
- [ ] Logging structured (Winston)
- [ ] Documentation (setup, env vars, API docs)
- [ ] E2E tests (import CSV → enrich → filter → export)
- [ ] Docker optimizations
- [ ] Cloudflare tunnel config example

---

## 4. Testing Strategy

**Layers**
- **Unit:** Service functions, parser, formula executor, validators
- **Integration:** Database + services (e.g., import CSV ends in DB rows)
- **E2E:** Full flow via HTTP (import table, add column with enrichment, filter, export)

**Tools**
- Jest (unit + integration)
- Supertest (HTTP layer)
- msw (mock service worker) for API enrichment tests
- Postgres testcontainers (isolated DB per test)

**Copertura Target:** 70%+ (core logic, API endpoints, security)

---

## 5. Aspetti di Sicurezza (Implementati)

- ✅ JWT auth, bcrypt password hash
- ✅ User isolation (user_id filter su ogni query)
- ✅ Input validation (Zod schemas)
- ✅ SQL injection prevention (parameterized queries)
- ✅ CORS configurato per frontend origin
- ✅ Rate limiting
- ✅ Webhook token auth
- ✅ Sanitizzazione CSV import
- ✅ Error messages non-leaky (non espongono schema)
- ✅ Logging degli accessi auth e enrichment jobs

---

## 6. Documentazione & Ripresa

**Docs da Scrivere**
- `SETUP.md`: Come installare + configurare localmente
- `API.md`: Endpoints, request/response examples
- `DEV.md`: Architecture rundown, come aggiungere feature
- `DEPLOYMENT.md`: Docker + Cloudflare tunnel step-by-step

**Intermedia (tra sessioni)**
- Inline comments per logica non-ovvia
- Commit messages descrittivi
- TODO comments per future work

---

## 7. Domande Aperte / Feedback Richiesto

Prima di partire col coding, ha senso tutto? Feedback su:

1. **Database schema:** Va bene JSONB per righe, o preferisci qualcosa di più strutturato?
2. **Formule:** Le funzioni che propongo bastano, o ti serve qualcosa di specifico?
3. **Enrichment:** OK avere la coda visibile in UI con retry/delay config?
4. **Frontend:** Glide Data Grid ok, o preferisci ag-grid / altro?
5. **Auth:** Username/password per ora? (No OAuth, no SSO)

---

**Prossimo step:** Approvi questa architettura (con feedback se necessario), e passo lo sviluppo a **Claude Sonnet 4.6** per il coding autonomo, test inclusi.
