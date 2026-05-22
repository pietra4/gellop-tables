# Developer Guide

This document explains the architecture and how to add new features.

## Deploy (VPS / Raspberry Pi) — un comando

```bash
# Clona (prima volta)
git clone <url> gellop-tables && cd gellop-tables

# Build & avvia tutto (genera .env, builda docker, up)
make deploy
```

Dopo aver configurato il remote, si aggiorna con:

```bash
git pull && make deploy
```

## Backend Architecture

### Layer Structure

```
HTTP Request
    ↓
Router (routes.ts)
    ↓
Controller (controller.ts) — validate input, call service
    ↓
Service (service.ts) — business logic
    ↓
Repository (repository.ts) — database queries
    ↓
Database (database.ts) — raw query execution
    ↓
Middleware (auth.ts, errorHandler.ts) — cross-cutting concerns
```

### Each Module Has:

- **controller.ts** — HTTP handlers, input validation, error handling
- **service.ts** — business logic, orchestration
- **repository.ts** — database queries
- **routes.ts** — route registration
- **types.ts** — TypeScript interfaces
- **__tests__** — unit & integration tests

### Example: Tables Module

```typescript
// tables/controller.ts
export async function createTableHandler(req, reply) {
  const input = CreateTableSchema.parse(req.body); // validation
  const userId = extractUserId(req);
  const table = await tableService.createTable(userId, input);
  reply.status(201).send(table);
}

// tables/service.ts
export async function createTable(userId: string, input: CreateTableInput) {
  return tableRepository.create(userId, input);
}

// tables/repository.ts
export async function create(userId: string, input: CreateTableInput) {
  const result = await query(
    'INSERT INTO tables (user_id, name, description, columns_metadata) VALUES ($1, $2, $3, $4) RETURNING *',
    [userId, input.name, input.description, JSON.stringify([])]
  );
  return result.rows[0];
}
```

## Adding a New Feature (Example: Delete Table)

### 1. Database Layer
Already exists: migration has `DELETE` permission via FK cascade.

### 2. Repository Layer
```typescript
// backend/src/modules/tables/repository.ts
export async function deleteById(tableId: string, userId: string): Promise<void> {
  const result = await query(
    'DELETE FROM tables WHERE id = $1 AND user_id = $2',
    [tableId, userId]
  );
  if (result.rowCount === 0) {
    throw new NotFoundError('Table');
  }
}
```

### 3. Service Layer
```typescript
// backend/src/modules/tables/service.ts
export async function deleteTable(tableId: string, userId: string): Promise<void> {
  return tableRepository.deleteById(tableId, userId);
}
```

### 4. Controller Layer
```typescript
// backend/src/modules/tables/controller.ts
export async function deleteTableHandler(request: FastifyRequest, reply: FastifyReply) {
  const userId = extractUserId(request);
  const { id } = request.params as { id: string };
  await tableService.deleteTable(id, userId);
  reply.status(204).send();
}
```

### 5. Routes
```typescript
// backend/src/modules/tables/routes.ts
app.delete('/tables/:id', { preHandler: authenticateToken }, deleteTableHandler);
```

### 6. Add Input Validation (if needed)
```typescript
// backend/src/core/validation.ts
export const DeleteTableSchema = z.object({
  id: z.string().uuid(),
});
```

### 7. Tests
```typescript
// backend/tests/integration/tables.test.ts
describe('DELETE /tables/:id', () => {
  it('should delete table', async () => {
    const user = await createTestUser();
    const table = await createTestTable(user.id);
    const res = await request(app.server).delete(`/tables/${table.id}`);
    expect(res.status).toBe(204);
  });

  it('should return 404 if table not found', async () => {
    const user = await createTestUser();
    const res = await request(app.server).delete(`/tables/non-existent-id`);
    expect(res.status).toBe(404);
  });
});
```

## Security Patterns

### User Isolation
**Always filter by user_id:**
```typescript
// WRONG: Returns tables for any user
const result = await query('SELECT * FROM tables WHERE id = $1', [tableId]);

// RIGHT: Only returns if user owns it
const result = await query(
  'SELECT * FROM tables WHERE id = $1 AND user_id = $2',
  [tableId, userId]
);
```

### Input Validation
**Always use Zod:**
```typescript
const schema = z.object({
  name: z.string().min(1).max(255),
  value: z.number().positive(),
});

const input = schema.parse(req.body); // throws if invalid
```

### Error Handling
**Use custom error classes:**
```typescript
import { ValidationError, NotFoundError, AuthorizationError } from './utils/errors';

throw new NotFoundError('Table');
throw new ValidationError('Invalid input');
throw new AuthorizationError('You do not own this table');
```

Errors are automatically caught and formatted by `errorHandler` middleware.

## Frontend Architecture

### State Management (Zustand)
Stores in `hooks/` — each hook is a Zustand store:

```typescript
// hooks/useTable.ts
export const useTable = create<TableState>((set) => ({
  table: null,
  loading: false,
  fetchTable: async (tableId: string) => {
    set({ loading: true });
    const response = await client.get(`/tables/${tableId}`);
    set({ table: response.data, loading: false });
  },
}));
```

Usage in component:
```typescript
const { table, loading } = useTable();
```

### API Client
Centralized in `api/client.ts` with:
- Automatic JWT injection
- 401 → logout redirect
- Error handling

```typescript
import client from '../api/client';
const response = await client.get('/tables');
```

### Components
Functional components with hooks:
```typescript
export const TableViewer: React.FC<{ tableId: string }> = ({ tableId }) => {
  const { table, loading, fetchTable } = useTable();

  useEffect(() => {
    fetchTable(tableId);
  }, [tableId]);

  if (loading) return <div>Loading...</div>;
  if (!table) return <div>Not found</div>;

  return <div>...</div>;
};
```

### Data Grid (Glide)
Example integration:
```typescript
import { DataEditor, GridCell, GridCellKind } from 'glide-data-grid';

export const TableGrid: React.FC = () => {
  const { rows } = useTable();

  const getCellContent = (cell: [number, number]): GridCell => {
    const [col, row] = cell;
    return {
      kind: GridCellKind.Text,
      data: rows[row]?.data[columns[col].name] || '',
      allowOverlay: true,
    };
  };

  return (
    <DataEditor
      columns={columns}
      rows={rows.length}
      getCellContent={getCellContent}
      onCellEdited={handleCellEdit}
    />
  );
};
```

## Testing

### Unit Tests (Service Logic)
```typescript
// tests/unit/enrichment.test.ts
describe('Enrichment Service', () => {
  it('should parse API response correctly', () => {
    const response = { name: 'John', age: 30 };
    const mapping = { name: 'enriched_name', age: 'enriched_age' };
    const result = parseEnrichmentResponse(response, mapping);
    expect(result).toEqual({ enriched_name: 'John', enriched_age: 30 });
  });
});
```

### Integration Tests (DB + Service)
```typescript
// tests/integration/tables.test.ts
describe('Tables Service', () => {
  let client: PoolClient;

  beforeAll(async () => {
    client = await getTestDatabase();
    await client.query('BEGIN');
  });

  afterAll(async () => {
    await client.query('ROLLBACK');
    client.release();
  });

  it('should create table with metadata', async () => {
    const userId = uuid();
    await client.query('INSERT INTO users (id, username, email, password_hash) VALUES ($1, $2, $3, $4)',
      [userId, 'test', 'test@test.com', 'hash']);

    const table = await tableService.createTable(userId, { name: 'Test' });
    expect(table.name).toBe('Test');
    expect(table.userId).toBe(userId);
  });
});
```

### E2E Tests (HTTP Layer)
```typescript
// tests/e2e/auth.test.ts
import request from 'supertest';

describe('Auth E2E', () => {
  it('should register and login', async () => {
    // Register
    const registerRes = await request(app.server)
      .post('/auth/register')
      .send({ username: 'newuser', email: 'new@test.com', password: 'pass123' });

    expect(registerRes.status).toBe(201);
    expect(registerRes.body.token).toBeDefined();

    // Login
    const loginRes = await request(app.server)
      .post('/auth/login')
      .send({ username: 'newuser', password: 'pass123' });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.token).toBeDefined();

    // Verify me endpoint
    const meRes = await request(app.server)
      .get('/auth/me')
      .set('Authorization', `Bearer ${loginRes.body.token}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.username).toBe('newuser');
  });
});
```

## Debugging Tips

### Backend
1. Add `console.log()` for quick debug (will appear in docker logs)
2. Use `logger.info()` / `logger.error()` for structured logs
3. Set breakpoints in VSCode with `.vscode/launch.json` config
4. Query database directly: `psql postgresql://clayite:pass@localhost/clayite`

### Frontend
1. Use React DevTools extension
2. `console.log()` in components / hooks
3. Network tab → see API requests/responses
4. Storage tab → check JWT in localStorage

## Performance Considerations

### Database
- Add indexes for common queries: `CREATE INDEX idx_name ON table(column);`
- Use `LIMIT` on paginated endpoints
- JSONB queries: `data->>'key_name'` for text, `data->'key_name'` for JSON

### Frontend
- Use `useMemo()` for expensive computations
- Lazy load heavy components (React.lazy)
- Virtual scroll for large tables (built into Glide)
- Memoize callback functions with `useCallback()`

## Code Style

- **TypeScript**: Strict mode always
- **Naming**: camelCase for JS, snake_case for DB
- **Imports**: Group by external, then local (absolute paths)
- **Comments**: Only for "why", not "what" — code should be self-documenting
- **No magic numbers**: Use constants

## Phase Checklist

### Phase 2: Tables & Rows
- [ ] Table CRUD repository/service/controller
- [ ] CSV import (parser, validation, bulk insert)
- [ ] Row CRUD
- [ ] Pagination on rows endpoint
- [ ] Tests: create table, import CSV, CRUD rows
- [ ] Frontend: table list, create form, table viewer stub

### Phase 3: Enrichment
- [ ] pg-boss job queue setup
- [ ] Enrichment service (API calls, parsing)
- [ ] Job status tracking
- [ ] Configurable concurrency/delay/retry
- [ ] Tests: mock API, job lifecycle
- [ ] Frontend: enrichment config, job progress UI

### Phase 4: Formulas
- [ ] Formula parser (tokenizer, AST)
- [ ] Executor with function library
- [ ] Tests: edge cases, security (no code eval)
- [ ] Frontend: formula editor

### Phase 5: Filters & Webhooks
- [ ] Filter logic (AND/OR, comparisons)
- [ ] Webhook endpoint + auth
- [ ] Tests: filtering, webhook payload validation
- [ ] Frontend: filter UI, webhook tester

### Phase 6: Polish
- [ ] E2E tests (full flow)
- [ ] Error messages (user-friendly)
- [ ] Logging (structured, searchable)
- [ ] Docs (API, setup, deployment)
- [ ] Performance (indexing, query optimization)

---

**See ARCHITECTURE.md for design decisions and SETUP.md for local development.**
