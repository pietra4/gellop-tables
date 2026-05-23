# Workplan Gellop Tables

Documento per l'agente che dovra riprendere lo sviluppo di Gellop Tables.

## Regole operative permanenti (richiesta Pietro)

Il push su GitHub deve farlo sempre l'agente dalla sessione container, a fine lavoro, senza scaricare il passaggio su Pietro.

Per aggiornare il Raspberry Pi, il riferimento operativo ufficiale e:

- SSH: `ssh pietra@pi`
- Path repo: `/home/pietra/servizi-produzione/gellop/strumenti-interni/gellop-tables`

Obiettivo: portare l'app a un primo livello usabile e verificabile, partendo dal problema concreto segnalato da Pietro: import CSV non affidabile nella UI e interfaccia TableView grezza.

## Stato del repository

Root progetto reale: `/home/node/.openclaw/workspace`.

Non lavorare nella cartella `gellop-tables/` come root principale: contiene soprattutto PRD/documentazione. Il codice applicativo vero e in:

- `backend/`
- `frontend/`
- `docker-compose.yml`
- `deploy.sh`
- `Makefile`

Ultimi commit rilevanti:

- `2c82935` Idempotent migrations: IF NOT EXISTS on indexes, graceful error handling
- `54e166d` Robust CSV import body parsing (string, Buffer, JSON)
- `7acc0d1` CSV file upload: auto-import on file select, fix async race
- `d9e2dae` Add CSV file upload (file input + text paste)

Stato working tree al momento della stesura:

- modifiche locali gia presenti in `backend/src/modules/rows/service.ts`
- modifiche locali gia presenti in `backend/tests/unit/rows.service.test.ts`
- modifiche locali gia presenti in `frontend/src/components/TableView.tsx`
- modifiche locali gia presenti in `frontend/src/components/TableView.css`
- modifiche locali gia presenti in `frontend/src/hooks/useTables.ts`
- file non tracciati di memoria OpenClaw in `memory/`, da ignorare per lo sviluppo applicativo

Importante: le modifiche locali sono una bozza operativa, non una soluzione da accettare alla cieca. Vanno lette, capite, eventualmente rifinite e poi verificate con flusso reale.

## Problema utente

Pietro ha segnalato che, importando un CSV, il contenuto sembrava finire come testo separato da virgole invece che creare una vera tabella con colonne e righe.

La UI e stata descritta come brutta e poco affidabile. Pietro non ha potuto testare il resto perche il blocco sull'import impediva di arrivare a un flusso utile.

Priorita: non fare subito un redesign totale. Prima rendere il flusso base solido:

1. login/registrazione
2. creazione tabella
3. import CSV
4. visualizzazione colonne e righe nella griglia
5. modifica cella senza perdita dati
6. feedback esplicito di errori/successo

## Diagnosi attuale

Il backend non appare completamente rotto:

- backend TypeScript compila
- i test unitari passavano gia prima
- frontend buildava
- il parser CSV ha test unitari
- esiste un content-type parser Fastify per `text/csv`
- endpoint import: `POST /tables/:id/import`

Il problema piu probabile lato UX/import e questo: dopo l'import CSV la TableView ricaricava le righe, ma non sempre ricaricava lo schema della tabella. Se il CSV introduce nuove colonne, il backend puo averle create in `columns_metadata`, ma la UI continua a renderizzare con la vecchia lista colonne. Risultato percepito: import fallito o dati mostrati male.

Secondo problema concreto trovato: l'edit cella nel frontend manda una patch parziale, per esempio `{ "email": "x@y.com" }`, ma il backend usava una update che sostituiva l'intero JSON della riga. Questo puo cancellare gli altri campi della riga dopo la modifica di una singola cella.

Terzo problema: test troppo mockati. I test attuali dicono che funzioni isolate si comportano bene, ma non provano davvero il flusso HTTP + DB + UI. Non bisogna fidarsi di un "verde" superficiale.

## Modifiche locali gia fatte da valutare

Bozza backend:

- `backend/src/modules/rows/service.ts`
- `updateRow()` e stato cambiato per usare `rowRepository.patchData()` invece di `rowRepository.update()`
- motivo: una modifica cella deve fare merge JSONB, non replace dell'intera riga

Bozza test:

- `backend/tests/unit/rows.service.test.ts`
- aggiunto test che verifica l'uso di `data = data || ...` per patch parziale

Bozza frontend store:

- `frontend/src/hooks/useTables.ts`
- aggiunto `getTable(id)` per ricaricare una singola tabella e aggiornare lo store

Bozza frontend TableView:

- `frontend/src/components/TableView.tsx`
- aggiunta funzione `loadTable()` che ricarica tabella + righe
- dopo import CSV ora dovrebbe ricaricare schema + rows
- aggiunto stato `isImporting`
- aggiunto messaggio di successo import con numero righe/colonne
- migliorato stato vuoto con CTA import/colonna

Bozza CSS:

- `frontend/src/components/TableView.css`
- pulizia leggera di toolbar/import panel/stato vuoto/responsive
- non e un redesign completo

Questa bozza ha gia passato:

- `cd backend && npm test -- --runInBand`
- `cd backend && npm run type-check`
- `cd frontend && npm run build`

Risultato osservato:

- 40 test backend passati
- build frontend completata
- warning Vite/Rollup su commenti `/*#__PURE__*/` e chunk grande, da libreria/griglia; non blocca

## Piano di lavoro consigliato

### Fase 0: sicurezza e baseline

Prima di modificare altro:

- leggere `git status --short`
- leggere il diff esistente con `git diff`
- non toccare `memory/`, `.openclaw/`, file runtime OpenClaw o note personali
- non fare reset hard
- non cancellare la bozza locale senza ragione

Comandi:

```bash
git status --short
git diff -- backend/src/modules/rows/service.ts backend/tests/unit/rows.service.test.ts frontend/src/hooks/useTables.ts frontend/src/components/TableView.tsx frontend/src/components/TableView.css
```

Decisione iniziale:

- se la bozza e coerente, rifinirla e tenerla
- se la bozza e sbagliata, sostituirla con una soluzione equivalente ma migliore
- in ogni caso mantenere gli obiettivi: schema reload dopo import e patch cella senza perdita dati

### Fase 1: validare import CSV lato backend

Verificare che il backend accetti almeno questi formati:

- `Content-Type: text/csv` con body raw
- JSON `{ "content": "a,b\n1,2" }`
- eventuale Buffer gestito da Fastify/parser

File da leggere:

- `backend/src/app.ts`
- `backend/src/modules/rows/routes.ts`
- `backend/src/modules/rows/controller.ts`
- `backend/src/modules/rows/service.ts`
- `backend/src/utils/csv.ts`
- `backend/src/modules/tables/service.ts`
- `backend/src/modules/tables/repository.ts`
- `backend/src/modules/rows/repository.ts`

Acceptance criteria backend:

- CSV con header `name,email,company` e due righe crea tre colonne metadata se mancanti
- crea due row JSONB, una per riga CSV
- CSV con header duplicato fallisce con errore chiaro
- CSV senza righe dati fallisce con errore chiaro
- CSV con campi quotati e virgole interne resta corretto
- CSV con CRLF resta corretto

Test minimi:

- tenere i test unitari parser CSV
- aggiungere o mantenere test su `importCsv()`
- idealmente aggiungere un integration test HTTP, anche piccolo, per `POST /tables/:id/import`

Nota: se creare un integration test con Postgres vero e troppo lungo per questa iterazione, almeno documentare il gap. Pero il prodotto non va considerato veramente verificato finche non c'e un test con DB reale o un manual test completo.

### Fase 2: correggere visualizzazione dopo import

Problema da risolvere:

- l'import puo aggiornare `columns_metadata`, ma la TableView deve ricaricare la tabella dopo l'import, non solo le righe

Soluzione preferita:

- aggiungere nel table store una funzione `getTable(id)`
- usarla in TableView per caricare lo schema fresco
- dopo import chiamare `getTable(id)` e poi `fetchRows(id)`, oppure una funzione unica `loadTable(id)`

File:

- `frontend/src/hooks/useTables.ts`
- `frontend/src/components/TableView.tsx`

Acceptance criteria frontend:

- tabella nuova senza colonne mostra CTA "Import CSV" e "Add column"
- importando CSV da textarea compaiono subito colonne e righe
- importando CSV da file compaiono subito colonne e righe
- dopo import appare feedback esplicito, non silenzio
- in caso errore appare messaggio leggibile
- il bottone import non parte con textarea vuota

### Fase 3: correggere edit cella

Problema:

- la griglia modifica una cella alla volta
- il payload e parziale
- il backend deve fare merge, non replace

Soluzione backend:

- `rowService.updateRow()` deve chiamare `rowRepository.patchData()`
- `rowRepository.update()` puo restare per eventuali replace futuri, ma non deve essere usato dal controller di edit cella se il contratto API e patch parziale

File:

- `backend/src/modules/rows/service.ts`
- `backend/src/modules/rows/repository.ts`
- `backend/tests/unit/rows.service.test.ts`

Acceptance criteria:

- row iniziale `{ name: "Ada", email: "old@example.com" }`
- PATCH `{ email: "new@example.com" }`
- row finale `{ name: "Ada", email: "new@example.com" }`
- nessun campo non incluso nella patch viene perso

### Fase 4: UI TableView, miglioramento chirurgico

Non trasformare l'app in landing page. Questa e una web app operativa tipo Clay/Airtable leggero. La UI deve essere densa, chiara, funzionale.

Interventi consigliati:

- toolbar piu leggibile: back compatto, nome tabella, row count, azioni a destra
- import panel pulito: file picker, textarea, stato import, errore/successo
- empty state operativo: azioni dirette, niente testo marketing
- responsive minimo: toolbar e form non devono esplodere su mobile
- evitare emoji nei controlli principali
- eliminare inline style dalla JSX dove facile
- mantenere Glide Data Grid come griglia principale

File:

- `frontend/src/components/TableView.tsx`
- `frontend/src/components/TableView.css`
- eventualmente `frontend/src/App.css`

Non fare in questa fase:

- redesign completo dashboard/login
- sostituzione di Glide Data Grid
- nuove dipendenze UI pesanti
- tema visuale complesso
- enrichment UI avanzata

Acceptance criteria UI:

- lo stato vuoto non e un vicolo cieco
- l'import e comprensibile senza guardare logs
- errori/successi sono visibili
- niente testo che trabocca nei bottoni principali
- layout usabile desktop; mobile almeno non rotto

### Fase 5: verifiche locali

Comandi minimi da eseguire:

```bash
cd backend && npm test -- --runInBand
cd backend && npm run type-check
cd frontend && npm run build
```

Se si vuole testare manualmente con UI:

```bash
docker compose up -d db
cd backend && npm run dev
cd frontend && npm run dev -- --host 0.0.0.0
```

Poi aprire:

```text
http://localhost:5173/
```

Attenzione: se il frontend gira in OpenClaw/remoto, Pietro potrebbe dover usare tunnel o URL esposto dal runtime. Non dare per scontato che `localhost` del container sia il localhost del Mac.

Manual test consigliato:

```csv
name,email,company
Ada Lovelace,ada@example.com,Analytical Engines
Grace Hopper,grace@example.com,US Navy
```

Flusso:

1. crea account/login
2. crea nuova tabella
3. importa il CSV da textarea
4. verifica colonne `name`, `email`, `company`
5. verifica 2 righe
6. modifica `company` della prima riga
7. verifica che `name` ed `email` restino intatti
8. ricarica pagina
9. verifica persistenza

### Fase 6: decidere cosa rimandare

Da non mischiare con il fix import/UI base:

- enrichment engine persistente e coda reale
- pg-boss/BullMQ mismatch nei documenti
- retry/delay enrichment
- formula parser
- export UX avanzata
- filtri/sorting UI completi
- test e2e Playwright
- deploy Cloudflare/Tailscale

Queste sono cose importanti, ma vengono dopo aver reso affidabile il flusso CSV -> tabella -> edit.

### Fase 7: readiness deploy Raspberry Pi

Non considerare il lavoro pronto per Pietro finche non e stato verificato almeno in ambiente Docker equivalente al Pi. "Builda in locale" non basta.

Obiettivo: arrivare a una versione che si possa deployare sul Raspberry Pi senza scoprire errori banali di runtime, migrazioni, env o rete.

Contesto noto:

- il Pi e raggiungibile via Tailscale a `100.117.95.73`, utente `pietra`
- la UI OpenClaw richiede tunnel SSH separato, ma Gellop Tables ha il proprio deploy Docker
- il repo risulta clonato sul Pi in `~/servizi-produzione/gellop/strumenti-interni/gellop-tables`
- `deploy.sh`, `docker-compose.yml`, `Makefile` e `SETUP.md` esistono e vanno riletti prima di deployare

Prima del deploy:

```bash
git status --short
cd backend && npm test -- --runInBand
cd backend && npm run type-check
cd frontend && npm run build
docker compose config
docker compose build
```

Verifiche Docker locali o su host equivalente:

```bash
docker compose up -d db
docker compose up -d --build
docker compose ps
docker compose logs --tail=200 app
docker compose logs --tail=200 frontend
```

Healthcheck minimo:

```bash
curl -fsS http://localhost:3000/health
```

Se il backend non e esposto direttamente dal compose, fare healthcheck dall'interno della rete Docker:

```bash
docker compose exec app wget -qO- http://localhost:3000/health
```

Verifica DB/migrazioni:

- avvio app senza errori di migration
- tabelle principali presenti
- nessun errore ripetuto nei log Postgres/app
- import CSV scrive effettivamente righe in DB

Manual test obbligatorio sull'istanza deployata:

1. aprire frontend deployato
2. login o registrazione
3. creare tabella nuova
4. importare CSV di prova da textarea
5. verificare colonne e righe in griglia
6. modificare una cella
7. ricaricare pagina
8. verificare che modifica e altri campi siano persistiti
9. importare lo stesso CSV o un secondo CSV da file upload
10. controllare log app/frontend durante il test

CSV di prova:

```csv
name,email,company
Ada Lovelace,ada@example.com,Analytical Engines
Grace Hopper,grace@example.com,US Navy
```

Log da controllare:

```bash
docker compose logs --tail=300 app
docker compose logs --tail=300 frontend
docker compose logs --tail=300 db
```

Deploy sul Pi:

- non deployare alla cieca se il working tree contiene modifiche non committate che non si vogliono portare
- decidere se deployare via git commit/pull o copia manuale; preferire git commit/pull
- sul Pi, fare backup o almeno verificare se il DB contiene dati importanti prima di reset/migrazioni invasive
- non usare comandi distruttivi sul volume Postgres senza consenso esplicito

Comandi indicativi sul Pi:

```bash
ssh pietra@100.117.95.73
cd ~/servizi-produzione/gellop/strumenti-interni/gellop-tables
git status --short
git pull
docker compose config
docker compose up -d --build
docker compose ps
docker compose logs --tail=200 app
```

Il lavoro e "pronto per deploy sul Pi" solo se:

- build Docker completa
- servizi Docker partono
- backend healthcheck risponde
- frontend e raggiungibile dal browser/tunnel previsto
- manual test CSV/edit passa sull'istanza deployata o su ambiente Docker equivalente
- log non mostrano errori ripetuti
- eventuali warning residui sono documentati e non bloccanti

## Rischi noti

Documentazione non allineata al codice:

- README/ARCHITECTURE parlano di pg-boss e architettura piu solida di quella effettivamente verificata
- alcune affermazioni "production ready" sono premature
- i test sono prevalentemente unit/mock

Enrichment:

- da audit precedente risultava sospetta una discrepanza tra documentazione e implementazione
- non blocca il fix import, ma non va presentato come affidabile finche non viene verificato end-to-end

CSV:

- parser custom ok per il momento, ma serve test con casi reali
- limite 100k righe lato service e bodyLimit 64 MB: coerenti, ma non testati con carichi grandi

UI:

- Glide Data Grid e potente ma richiede attenzione su dimensioni container
- se la tabella non ha colonne, la griglia non puo mostrare dati
- dopo import lo schema fresco e indispensabile

## Prompt consigliato per l'agente sviluppatore

Usa questo prompt come base:

```text
Siamo nel repo Gellop Tables in /home/node/.openclaw/workspace.
Leggi WORKPLAN_GELLOP_TABLES.md e riprendi da li.
Non fare redesign totale.
Obiettivo di questa sessione: rendere affidabile import CSV -> schema colonne -> righe visibili in TableView, correggere edit cella per non cancellare gli altri campi, migliorare solo la UI necessaria del pannello import/stato vuoto/feedback.
Prima leggi git status e git diff: ci sono modifiche locali bozza da valutare, non cancellarle alla cieca.
Alla fine esegui backend test, backend type-check e frontend build.
Riporta file modificati e verifiche.
```

## Definizione di done

La task puo dirsi chiusa solo quando:

- import CSV da textarea funziona manualmente
- import CSV da file funziona manualmente oppure viene indicato esattamente perche non e stato testato
- colonne create dal CSV compaiono subito nella griglia
- righe importate compaiono subito nella griglia
- edit cella non cancella gli altri dati della riga
- backend test passano
- backend type-check passa
- frontend build passa
- Docker build passa
- i servizi Docker partono correttamente
- backend healthcheck passa
- manual test import/edit passa in ambiente Docker equivalente al Pi, o direttamente sul Pi
- log app/frontend/db sono controllati e non mostrano errori bloccanti
- eventuali gap sono scritti chiaramente, non nascosti
