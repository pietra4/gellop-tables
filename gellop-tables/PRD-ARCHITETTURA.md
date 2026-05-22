# Gellop Tables — Documento di Architettura

> Piattaforma self-hosted stile Clay, solo la tabella interattiva.
> Niente AI integrata, niente agenti, niente marketplace di integrazioni.
> È un foglio di calcolo intelligente con capacità di enrichment via API esterne.

---

## 1. Stack Tecnologico

| Layer | Scelta | Perché |
|-------|--------|--------|
| Database | **PostgreSQL** con colonne dinamiche in JSONB | Righe hanno colonne diverse per tabella. JSONB + indice GIN dà query performanti senza migrazioni. |
| Backend | **Node.js + TypeScript + Express/Fastify** | Quello che conosco meglio, scelta pragmatica. |
| Frontend | **React + AG Grid** (Community Edition) | AG Grid regge 100k righe fluide, ha editing inline, filtri, sorting nativi. Stile spreadsheet già pronto. |
| Auth | **Better-Auth** (o simple JWT con bcrypt) | Leggero, self-contained, niente dipendenze cloud. |
| Coda enrichment | **BullMQ + Redis** | Coda persistente, visibilità, controllo concorrenza, retry, job events in real-time. |
| Docker | **docker-compose** (app + postgres + redis) | Gira sul Raspberry. |
| Accesso esterno | **Cloudflare Tunnel** (cloudflared) | Zero porte aperte, HTTPS gratis. |

---

## 2. Database Schema

### `workspaces`
| Colonna | Tipo | Note |
|---------|------|------|
| id | UUID PK | |
| name | TEXT | Nome workspace |
| owner_id | UUID FK → users | |
| created_at | TIMESTAMPTZ | |
| settings | JSONB | Preferenze globali (concorrenza default, ecc.) |

### `tables`
| Colonna | Tipo | Note |
|---------|------|------|
| id | UUID PK | |
| workspace_id | UUID FK → workspaces | |
| name | TEXT | |
| schema | JSONB | **Definizione delle colonne.** Vedi sotto. |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### `rows`
| Colonna | Tipo | Note |
|---------|------|------|
| id | UUID PK | |
| table_id | UUID FK → tables | |
| data | JSONB | `{"col_1": "val", "col_2": 42, ...}` — ogni chiave è l'ID colonna nello schema |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### `users`
| Colonna | Tipo | Note |
|---------|------|------|
| id | UUID PK | |
| email | TEXT UNIQUE | |
| password_hash | TEXT | bcrypt |
| name | TEXT | |
| created_at | TIMESTAMPTZ | |

### `enrichment_runs`
| Colonna | Tipo | Note |
|---------|------|------|
| id | UUID PK | |
| column_id | UUID | ID colonna a cui appartiene il job |
| status | TEXT | pending / running / completed / failed |
| total_rows | INT | |
| completed_rows | INT | |
| config | JSONB | API endpoint, headers, mapping input → API params |
| created_at | TIMESTAMPTZ | |
| completed_at | TIMESTAMPTZ | NULL se in corso |

### `enrichment_logs`
| Colonna | Tipo | Note |
|---------|------|------|
| id | UUID PK | |
| run_id | UUID FK → enrichment_runs | |
| row_id | UUID FK → rows | |
| status | TEXT | success / error |
| request_payload | JSONB | |
| response_body | JSONB | Per debug |
| error_message | TEXT | |
| created_at | TIMESTAMPTZ | |

### Schema colonna (JSONB in `tables.schema`)
```json
{
  "columns": [
    {
      "id": "col_uuid_1",
      "name": "Nome Azienda",
      "type": "text",
      "order": 0
    },
    {
      "id": "col_uuid_2",
      "name": "Email",
      "type": "text",
      "order": 1
    },
    {
      "id": "col_uuid_3",
      "name": "LinkedIn URL",
      "type": "text",
      "order": 2
    },
    {
      "id": "col_uuid_4",
      "name": "Descrizione",
      "type": "enrichment",
      "order": 3,
      "enrichment": {
        "api_url": "https://api.esempio.com/enrich",
        "method": "POST",
        "headers": {
          "Authorization": "Bearer {{ENV_API_KEY}}"
        },
        "request_template": {
          "company": "{{col_uuid_1}}",
          "email": "{{col_uuid_2}}"
        },
        "response_mapping": {
          "description": "$.data.description",
          "industry": "$.data.industry",
          "size": "$.data.size"
        },
        "output_columns": [
          {
            "name": "Descrizione",
            "path": "$.data.description"
          },
          {
            "name": "Settore",
            "path": "$.data.industry"
          },
          {
            "name": "Dipendenti",
            "path": "$.data.size"
          }
        ],
        "max_concurrency": 5
      }
    }
  ]
}
```

**Come funziona:** Una colonna di tipo `enrichment` genera automaticamente le colonne di output (figlie) nello schema. Quando parte un enrichment run, per ogni riga viene chiamata l'API, e i valori vengono scritti nelle colonne figlie.

---

## 3. Moduli Backend

### Modulo 1: Auth
- `POST /api/auth/register` — crea utente + workspace
- `POST /api/auth/login` — restituisce JWT
- Middleware JWT su tutte le route (tranne register/login)
- Primo utente amministratore del workspace

### Modulo 2: Tables CRUD
- `GET /api/tables` — lista tabelle del workspace
- `POST /api/tables` — crea tabella con schema
- `PUT /api/tables/:id` — modifica tabella (nome, schema colonne)
- `DELETE /api/tables/:id` — elimina tabella + tutte le righe
- `POST /api/tables/:id/rows` — import da CSV (multipart), processa in batch
- `GET /api/tables/:id/rows?page=&limit=&sort=&filter=` — query paginata con filtri e sorting JSONB
- `PUT /api/tables/:id/rows/:rowId` — modifica cella specifica
- `DELETE /api/tables/:id/rows/:rowId`
- `POST /api/tables/:id/rows` — aggiunta singola riga

### Modulo 3: Webhook in ingresso
- `POST /api/webhooks/:tableId` — no auth (o API key fissa), aggiunge riga alla tabella
- Body JSON mappato sulle colonne della tabella
- Utile per: ricevere lead da form, webhook esterni, Zapier/Make

### Modulo 4: Enrichment Engine (critico)
- `POST /api/tables/:id/columns/:colId/enrich` — avvia enrichment run
- `GET /api/tables/:id/columns/:colId/runs` — storico run per colonna
- `GET /api/tables/:id/columns/:colId/runs/:runId` — dettaglio run (progresso)
- `GET /api/tables/:id/columns/:colId/runs/:runId/logs?page=` — log dettagliato

Il cuore è **BullMQ**:
- All'avvio di un enrichment: crea un job nella coda `enrichment` per OGNI riga (con throttle)
- Worker processa i job: compila `request_template` sostituendo `{{col_id}}` con valori della riga, chiama API, scrive risposta nelle colonne output
- `max_concurrency` configurabile a livello di colonna (default da workspace settings)
- Retry automatico su fallimento (3 tentativi con backoff)
- WebSocket per aggiornamenti in tempo reale (vedi sotto)

### Modulo 5: Real-time updates (WebSocket)
- `Socket.IO` su endpoint `/ws`
- Client subscribe a `table:{tableId}` 
- Eventi: `row:updated`, `enrichment:progress`, `enrichment:completed`
- Così la UI aggiorna in tempo reale senza polling

### Modulo 6: Admin/Monitoring
- `GET /api/system/status` — health check (DB, Redis, coda)
- `GET /api/system/enrichment-queue` — dimensione coda, workers attivi

---

## 4. Frontend

### Tech
- **React + Vite** (build veloce, HMR)
- **AG Grid Community** — data grid virtualizzata che regge 100k righe
- **React Router** — navigazione
- **Tailwind CSS** — UI pulita senza librerie pesanti
- **Socket.IO client** — real-time updates

### Pagine
1. **Login / Register** — template minimale
2. **Workspace Dashboard** — lista tabelle, crea nuova
3. **Table View** — la pagina principale, tutta qua:
   - AG Grid con le righe
   - Pannello laterale con lo schema colonne
   - Bottone "Start Enrichment" per colonna enrichment
   - Barra superiore: filtri, sorting, colonna di ricerca
   - Modal "Run History" per vedere stato enrichments
4. **Api Settings** — dove configurare le API keys (salvate encrypted nel DB, non nel frontend)

### Table View in dettaglio
- **Header righe congelato** — sempre visibile
- **Editing inline** — clicca cella, modifica, ESC annulla, Enter conferma
- **Colonne colorate** per tipo (text=neutro, enrichment output=leggermente evidenziato)
- **Progress bar** per enrichment in corso
- **Pulsante "Enrich"** sulla colonna — avvia o ripeti enrichment

---

## 5. Deployment

### Hardware
- Raspberry Pi 4/5 — 16GB RAM, 4 core (quello che hai)
- OS: 64-bit (Ubuntu Server o Raspberry Pi OS)

### Docker Compose
```yaml
services:
  postgres:
    image: postgres:16-alpine
    volumes:
      - pgdata:/var/lib/postgresql/data
    environment:
      POSTGRES_DB: gellop_tables
      POSTGRES_PASSWORD: ${DB_PASSWORD}

  redis:
    image: redis:7-alpine
    volumes:
      - redisdata:/data

  backend:
    build: ./backend
    ports:
      - "3000:3000"
    depends_on: [postgres, redis]
    environment:
      DATABASE_URL: postgres://...${DB_PASSWORD}@postgres/gellop_tables
      REDIS_URL: redis://redis:6379
      JWT_SECRET: ${JWT_SECRET}

  frontend:
    build: ./frontend
    ports:
      - "5173:5173"
    depends_on: [backend]

  # Solo se non usi Cloudflare Tunnel
  # caddy:
  #   image: caddy:2-alpine
  #   ports:
  #     - "80:80"
  #     - "443:443"
  #   volumes:
  #     - ./Caddyfile:/etc/caddy/Caddyfile
  #   depends_on: [backend, frontend]

volumes:
  pgdata:
  redisdata:
```

### Accesso esterno (Cloudflare Tunnel)
```bash
# Sul Raspberry
docker run -d --network=host cloudflare/cloudflared tunnel --no-autoupdate run \
  --token ${CF_TUNNEL_TOKEN}
```

- Il tunnel punta a `localhost:3000` (backend serve anche il frontend buildato in produzione, o in alternativa nginx/Caddy che fa da reverse proxy)
- HTTPS automatico via Cloudflare
- Zero configurazione DNS

---

## 6. Sicurezza

- **Password** bcrypt con cost factor 12
- **JWT** con scadenza (configurabile, default 24h)
- **API keys** salvate encrypted con AES-256-GCM (chiave in env)
- **CORS** limitato al dominio del frontend
- **Rate limiting** sulle route di login e webhook
- **Input validation** con Zod su ogni endpoint
- **SQL injection** impossibile: parametri con pg driver
- **CSRF** gestito da CORS + SameSite cookie (se usi cookie per refresh token)
- No dipendenze preoccupanti — tutto open source self-hosted

---

## 7. Cosa rimane da decidere

Queste sono le cose che **devi decidere tu** prima che inizi a sviluppare:

### A. Multi-utente
- Solo tu (un utente singolo su tutto)? → semplifica tanto (niente workspaces)
- Multi-utente con tabelle separate per persona ma **condivisibili**? (es. invito via email)
- Multi-utente ma ognuno ha le sue tabelle e basta?

### B. Formule
- Ti basta spreadsheet base (CONCAT, UPPER, LOWER, IF, + - * /)?
- Vuoi espressioni arbitrarie tipo JavaScript sandboxed?
- Le formule vanno valutate lato client (immediate, ma solo in UI) o lato server (permanenti)?
- O le formule non le vuoi proprio e la tabella è solo dati + enrichment?

### C. Concorrenza enrichment
- **Globale**: un limite unico per tutte le colonne enrichment (es. max 10 chiamate in parallelo in totale)
- **Per colonna**: ogni colonna ha il suo limite e possono correre in parallelo (es. col A max 5, col B max 3)
- **Entrambi**: limite per colonna + tetto globale configurabile

### D. Export
- Vuoi poter esportare la tabella in CSV/XLSX dopo l'enrichment? (Facile da aggiungere, ma lo segno)

### E. Webhook in entrata
- Solo aggiunta righe, o anche update? (utile per sincronizzazioni bidirezionali)

---

## 8. Roadmap di Sviluppo

In ordine di priorità:

### Fase 1 — Scheletro 🦴
- Backend: auth, tables CRUD, rows CRUD con query paginata
- Frontend: login, dashboard, table view con AG Grid
- Docker compose con postgres
- **Milestone**: importi CSV, vedi tabella, modifichi celle

### Fase 2 — Enrichment 🚀
- Backend: engine enrichment con BullMQ + Redis
- Frontend: pulsante enrichment, progress bar, run history
- WebSocket in tempo reale
- **Milestone**: clicchi "Enrich" su una colonna, vedi popolarsi in tempo reale

### Fase 3 — Rifiniture ✨
- Webhook in ingresso
- Filtri e sorting avanzati
- Export CSV
- Rate limiting, security audit
- Cloudflare Tunnel setup
- **Milestone**: tutto funzionante, deployato, usabile da fuori

### Fase 4 — Formule (se le vuoi)
- Engine formule
- Editable nello schema colonna
- **Milestone**: colonne formula che computano in tempo reale

---

## 9. Stime e Trade-off

### Stima righe
- JSONB su Postgres: perfettamente ok per 100k righe con indice GIN
- AG Grid: 100k righe fluide senza virtualizzazione
- **Limite realistico consigliato**: 100k righe per tabella, oltre va spezzato
- Se superi 500k righe su Raspberry, considera indici parziali o archiviazione vecchie righe

### Trade-off fatti
| Decisione | Alternativa scartata | Perché |
|-----------|---------------------|--------|
| JSONB per righe | Tabella EAV classica | JSONB più semplice, query più facili, giusto con indici |
| AG Grid | React Table / TanStack Table / custom | AG Grid ha editing, filtri, sorting, virtualizzazione già pronti |
| BullMQ | Coda custom con setTimeout | BullMQ dà persistenza, monitoring, retry, concorrenza |
| TypeScript | JavaScript puro | Type error zero a runtime — su un progetto business non si scherza |

---

## Prossimo passo

Leggi il documento, rispondi alle decisioni aperte (sezione 7) e confermi o modifichi. Appena approvato, parto con lo sviluppo.

Tutto il codice sarà nella cartella `gellop-tables/` del workspace.
