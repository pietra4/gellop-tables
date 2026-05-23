# Gellop Tables

A self-hosted, interactive data table platform similar to Clay, but lightweight and focused on core table functionality.

## Features

- **Interactive Data Tables**: Import CSV, add/remove columns, edit cells
- **Enrichment via API**: Add columns that call external APIs and populate cells
- **Formula Columns (server-run)**: formula columns can be executed in bulk with API feedback
- **Multi-user Support**: User authentication with JWT
- **Filtering, Sorting, Saved Views**: per-column filters, sorting, and saved table views
- **Webhook Integration**: Add rows to tables via webhooks
- **Performance**: Handles 25k–100k rows efficiently with virtual scrolling

## Technology Stack

- **Backend**: Node.js + TypeScript + Fastify
- **Database**: PostgreSQL (with JSONB for flexible row storage)
- **Frontend**: React + TypeScript + Glide Data Grid
- **Deployment**: Docker Compose
- **Queue**: pg-boss (Postgres-backed job queue for enrichment)

## Quick Start

### Prerequisites

- Docker & Docker Compose
- Node.js 20+ (for local development without Docker)
- PostgreSQL 16+ (if running without Docker)

### With Docker Compose

```bash
# Copy env files
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# Start services
docker-compose up

# Backend: http://localhost:3000
# Frontend: http://localhost:5173
```

### Local Development

**Backend:**
```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

**Frontend:**
```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

## Project Structure

```
clayite/
├── backend/
│   ├── src/
│   │   ├── core/          # Auth, database, validation
│   │   ├── modules/       # Feature modules (tables, rows, enrichment, etc.)
│   │   ├── middleware/    # Auth, error handling
│   │   ├── utils/         # Logger, errors, helpers
│   │   └── app.ts         # Fastify server
│   ├── migrations/        # SQL migrations
│   ├── tests/             # Unit & integration tests
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── hooks/         # Custom hooks (auth, data fetching)
│   │   ├── api/           # API client
│   │   ├── types/         # TypeScript types
│   │   └── App.tsx        # Main app
│   ├── index.html
│   └── package.json
├── docker-compose.yml
└── ARCHITECTURE.md        # Detailed architecture docs
```

## Development Phases

1. **Phase 1**: Setup base + Auth ✅ (in progress)
2. **Phase 2**: Tables & Rows (CSV import, CRUD)
3. **Phase 3**: Enrichment (API calls, job queue, progress)
4. **Phase 4**: Formulas (parser, executor, functions)
5. **Phase 5**: Filters & Webhooks
6. **Phase 6**: Polish & Deploy (logging, docs, E2E tests)

## API Endpoints

### Auth
- `POST /auth/register` - Register user
- `POST /auth/login` - Login user
- `GET /auth/me` - Get current user (requires auth)

### Tables
- `GET /tables` - List tables
- `POST /tables` - Create table
- `GET /tables/:id` - Get table schema
- `PUT /tables/:id` - Update table
- `DELETE /tables/:id` - Delete table

### Rows
- `GET /tables/:id/rows` - List rows (paginated)
- `POST /tables/:id/rows` - Add row
- `PUT /tables/:id/rows/:rowId` - Update row
- `DELETE /tables/:id/rows/:rowId` - Delete row
- `POST /tables/:id/formula/run` - Run a formula column on all rows

### Enrichment
- `POST /tables/:id/enrich` - Start enrichment for a column name
- `GET /tables/:id/enrich/runs` - List enrichment runs
- `GET /tables/:id/enrich/runs/:runId` - Get run status

## Security

- ✅ Bcrypt password hashing
- ✅ JWT authentication
- ✅ User isolation (all queries filtered by user_id)
- ✅ Input validation (Zod schemas)
- ✅ SQL injection prevention (parameterized queries)
- ✅ CORS configured
- ✅ Rate limiting
- ✅ Webhook token auth

## Deployment

### Raspberry Pi + Cloudflare Tunnel

```bash
# Create Cloudflare tunnel
cloudflared tunnel create clayite

# Auth Cloudflare
cloudflared tunnel login

# Create DNS record pointing to tunnel
# Update docker-compose.yml with CF_TOKEN

# Start containers
docker-compose up -d

# Service now available at: https://clayite.your-domain.com
```

## Testing

```bash
# Backend tests
cd backend
npm test              # Run all tests
npm run test:watch   # Watch mode
npm run test:coverage # Coverage report

# Frontend (coming soon)
cd frontend
npm test
```

## Contributing

See ARCHITECTURE.md for detailed technical decisions and design patterns.

## License

MIT
