# Deploy

## Un comando (VPS / Raspberry Pi / qualsiasi Linux)

```bash
# Primo clone
git clone https://github.com/pietra4/gellop-tables && cd gellop-tables
make deploy

# Aggiornamento
git pull
make deploy
```

`make deploy` genera automaticamente `.env` con password e JWT random, builda i container, avvia tutto. Se cambi le credenziali, cancella `.env` e rilancia.

## Porte

| Servizio | Default | Variabile d'ambiente |
|---|---|---|
| Frontend | 5173 | `FRONTEND_PORT` |
| Backend API | 3000 | `APP_PORT` |

Esempio con porte personalizzate:
```bash
APP_PORT=9000 FRONTEND_PORT=8080 make deploy
```

## Dietro Cloudflare Tunnel

Per esporre su un dominio pubblico senza aprire porte:

1. Installa `cloudflared` sul server
2. Crea un tunnel (vedi docs Cloudflare)
3. Punta al servizio locale, es. `http://localhost:5173`

## Dietro Tailscale

Se hai Tailscale, il servizio è raggiungibile sull'IP tailnet del server alla porta della frontend (default 5173). Niente configurazione extra.

## Variabili d'ambiente (`.env` alla root del progetto)

```
DB_PASS=...           # Password PostgreSQL (generata automaticamente)
JWT_SECRET=...        # Chiave JWT (generata automaticamente)
APP_PORT=3000         # Porta backend sull'host (opzionale)
FRONTEND_PORT=5173    # Porta frontend sull'host (opzionale)
```

## Esternalità

- Docker (testato su Ubuntu 22.04+ / Raspberry Pi OS Bookworm)
- docker compose plugin
- openssl (per generare i secret)
- Almeno 2 GB di RAM, 5 GB liberi su disco
