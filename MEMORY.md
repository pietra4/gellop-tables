# MEMORY.md — Memoria a lungo termine di Tro-IA

_Indice top-level. Una sottocartella per topic, una mini-wiki per progetto._

## Identità

- [Chi sono](memory/identity/tro-ia.md) — Tro-IA 🐴, lavoro con Pietro in italiano

## Utente

- [Pietro](memory/user/pietro.md) — chi è, ruoli (Gellop + Yupec), preferenze

## Progetti

### [Gellop](memory/projects/gellop/INDEX.md) — agenzia B2B
- [Profilo agenzia](memory/projects/gellop/profile.md) — chi sono, servizi, posizionamento, stack
- [Team & ID CRM](memory/projects/gellop/team.md) — UUID Twenty CRM dei soci
- [LinkedIn](memory/projects/gellop/linkedin.md) — supporto post LinkedIn

### [Yupec Service Italia](memory/projects/yupec/INDEX.md) — saldatura laser
- [Profilo azienda](memory/projects/yupec/profile.md) — prodotti, posizionamento
- [Outbound — TAM](memory/projects/yupec/outbound-tam.md) — costruzione TAM campagne (in popolazione)

## Feedback su come lavoro

- [Tono diretto — no liste Wikipedia](memory/feedback/tono-diretto.md) — se è "no", dirlo subito con ironia
- [Query task CRM](memory/feedback/task-query.md) — filtrare sempre per follower=PIETRO

## Infrastruttura

- [OpenClaw Web UI — accesso SSH tunnel](memory/infrastructure/openclaw-access.md) — **CRITICO**: serve tunnel SSH

---

## Convenzioni wiki

- Una cartella per topic principale: `user/`, `feedback/`, `infrastructure/`, `identity/`, `projects/<nome>/`.
- Ogni progetto ha un file `INDEX.md` (hub) + pagine separate per dominio (profilo, team, sotto-iniziative).
- Link interni con sintassi `[[name]]` dove `name` è il valore frontmatter `name:` della pagina di destinazione.
- Frontmatter obbligatorio: `name`, `description`, `metadata.type` (user/feedback/project/reference).
