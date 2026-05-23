# Changelog — Gellop Tables

Tutti i cambiamenti degni di nota.

## 2026-05-23 — Hardening import CSV + refresh UI TableView

### Fixed
- **Import CSV body parsing**: rimosso fallback pericoloso che serializzava body JSON non valido in pseudo-CSV, ora l'endpoint accetta solo testo CSV reale o wrapper JSON con stringa CSV.
- **CSV parser**: aggiunto strip BOM UTF-8 sulla prima intestazione, auto-rilevamento delimitatore (`,` `;` `tab`) e validazione rigida del numero colonne per riga.
- **Regressione coperta**: nuovi test unitari per BOM, delimitatore `;` e righe incoerenti.

### Changed
- **TableView UX**: nuova struttura con sidebar workspace + area grid centrale e toolbar azioni, mantenendo Glide Data Grid come motore e senza regressioni su import/edit/enrichment.

## 2026-05-22 — Sviluppo completo Phase 1-3 + deploy su Raspberry Pi

### Added
- **Auth**: registrazione, login, JWT (`/auth/me`), middleware autenticazione
- **Tables CRUD**: creazione, lettura, eliminazione tabelle con metadati colonne in JSONB
- **Rows CRUD**: righe con paginazione, sorting, filtri (`filter[col]=val`), JSONB per dati
- **CSV import**: parser RFC-4180 custom, chunking 500 righe per INSERT, limite 100k righe, upload file
- **CSV export**: esportazione tabella completa in CSV
- **Columns**: aggiunta/rimozione colonne, tipi (string, number, date, boolean, enrichment, formula), ensureColumns automatico
- **Enrichment engine**: esecuzione API in batch, response mapping via JSONPath, progressi real-time, pg-boss codec
- **WebSocket**: endpoint `/ws` con subscribe per tableId, broadcast eventi enrichment a client connessi
- **Webhooks**: creazione/revoca token, endpoint pubblico `/webhook/incoming/:token`
- **Frontend**: login/register form, dashboard, griglia dati interattiva (Glide Data Grid), supporto colonne enrichment, WebSocket client, progress bar enrichment
- **Docker**: docker-compose.yml con app, frontend (nginx), PostgreSQL 16, Redis 7, cloudflared (profilo)
- **Deploy**: `deploy.sh` one-command, `Makefile` con target deploy/up/down/logs/test/build, `SETUP.md`
- **Cloudflare Tunnel**: cloudflared integrato con profilo, documentazione in SETUP.md
- **Test**: 39 unit test (tables.service, rows.service, csv, validation)

### Fixed
- **bcrypt** → **bcryptjs**: rimossi binding nativi per compatibilità Alpine/arm64 (commit `15c65bc`)
- **@fastify/websocket**: pinnato a v7 per compatibilità con Fastify v4 (commit `7600318`)
- **WebSocket handler**: API SocketStream v7 invece di raw WebSocket (commit `7127f91`)
- **Migration path Docker**: copiate in `/app/migrations/` anziché `dist/migrations/` (commit `079c28d`)
- **CSV upload frontend**: auto-import su file select, rimosso race condition async (commit `7acc0d1`)
- **Docker compose**: costruito per non sporcare git con `sed`, variabili via `.env` nativo (commit `a4d156a`)
- **Porte esposte**: solo frontend 5173 sull'host, db/redis solo rete interna (commit `1e765fa`)
- **Nginx proxy**: aggiunto `/ws` WebSocket, `/api/` proxy a backend, build arg VITE_API_URL (commit `09f8fc2`)

### Changed
- TS strict mode, ESM, Jest con configurazione CJS per i test
- Package lock aggiornato per compatibilità arm64
