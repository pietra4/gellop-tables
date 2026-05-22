# Setup & Development Guide

## Local Development Setup

### Prerequisites
- Node.js 20+
- PostgreSQL 16+ (or Docker)
- npm 9+

### Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Initialize database (migrations run automatically on app start)
npm run dev
```

The backend will start on `http://localhost:3000` and automatically run migrations on the first run.

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Start dev server
npm run dev
```

The frontend will start on `http://localhost:5173`.

### Using Docker Compose

```bash
# Create env files
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# Build and start
docker-compose up

# In another terminal, check database is ready
docker-compose logs postgres

# Services will be available at:
# - Backend: http://localhost:3000
# - Frontend: http://localhost:5173
# - Database: localhost:5432
```

## Testing the Auth Flow

### 1. Register a User
```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "password123"
  }'
```

Response:
```json
{
  "userId": "uuid...",
  "token": "jwt-token..."
}
```

### 2. Login
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "password123"
  }'
```

### 3. Get User Info (Authenticated)
```bash
curl -X GET http://localhost:3000/auth/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Database

### Connecting to PostgreSQL

```bash
# From Docker
docker-compose exec postgres psql -U clayite -d clayite

# From local (if installed)
psql postgresql://clayite:clayite_dev_pass@localhost:5432/clayite
```

### Useful SQL Queries

```sql
-- List all users
SELECT id, username, email, created_at FROM users;

-- List all tables for a user
SELECT id, name, created_at FROM tables WHERE user_id = 'USER_ID';

-- List rows in a table
SELECT id, data FROM rows WHERE table_id = 'TABLE_ID' LIMIT 10;
```

## Development Workflow

1. **Make changes** to backend/frontend code
2. **Tests run automatically** (watch mode)
3. **Commit frequently** with clear messages
4. **Check logs** with `docker-compose logs SERVICE_NAME`

### Running Tests

```bash
cd backend

# Run all tests
npm test

# Watch mode
npm test:watch

# Coverage report
npm test:coverage
```

## Common Issues

### "Cannot find module" errors
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Database connection fails
```bash
# Check Postgres is running
docker-compose logs postgres

# Check environment variables in .env match docker-compose.yml
```

### Port already in use
```bash
# Find process on port
lsof -i :3000
# Kill it
kill -9 PID

# Or change port in .env
API_PORT=3001
```

### CORS errors in frontend
Make sure `CORS_ORIGIN` in backend .env matches your frontend URL (default: `http://localhost:5173`)

## Debugging

### Backend Logs
```bash
# See all logs
docker-compose logs backend

# Follow logs
docker-compose logs -f backend

# Filter errors
docker-compose logs backend | grep ERROR
```

### Frontend DevTools
Open browser DevTools (F12) → Console tab → Network tab to see API calls

### Database Inspect
```bash
docker-compose exec postgres psql -U clayite -d clayite
```

Then run SQL queries to inspect data.

## Next Steps (Phase 2)

Once basic auth is working, next phase is:
1. Table CRUD endpoints
2. CSV import functionality
3. Row CRUD endpoints
4. Frontend table viewer with Glide Data Grid

See ARCHITECTURE.md for detailed design decisions.
