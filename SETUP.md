# Deploy

## Primo deploy

```bash
git clone https://github.com/pietra4/gellop-tables && cd gellop-tables
make deploy
```

## Aggiornamento

```bash
git pull
make deploy
```

## Requisiti

- Docker (testato su Ubuntu 22.04+ / Raspberry Pi OS Bookworm)
- docker compose plugin
- openssl

## Cosa fa deploy.sh

1. Genera `.env` con DB_PASS e JWT_SECRET random (se non esiste gia')
2. Ferma i container vecchi con `docker compose down`
3. Builda e avvia tutto

## Cloudflare Tunnel (raccomandato)

Unica via per esporre su dominio pubblico senza aprire porte su router o VPS.

### 1. Crea il tunnel su Cloudflare

Vai su Cloudflare Zero Trust > Networks > Tunnels > Crea un tunnel, scegli `cloudflared`. Ti dara' un token tipo `eyJhIjoi...`.

### 2. Aggiungi il token al `.env`

```bash
echo "CF_TUNNEL_TOKEN=eyJhIjoi..." >> .env
```

### 3. Esegui

```bash
make deploy
```

### 4. Configura il dominio (su Cloudflare)

Nel pannello del tunnel, aggiungi una route pubblica:
- **Dominio**: `gellop-tables.tuodominio.com`
- **Servizio**: `http://frontend:5173`

## Dietro Tailscale

Se siete sulla tailnet di Gellop, il servizio e' raggiungibile sull'IP Tailscale del server: `http://100.x.x.x:5173`. Zero configurazione.

## Variabili d'ambiente (.env)

| Variabile | Descrizione |
|---|---|
| DB_PASS | Password PostgreSQL |
| JWT_SECRET | Chiave per firmare i token JWT |
| CF_TUNNEL_TOKEN | Token del tunnel Cloudflare |

## Architettura

```
Browser -> Cloudflare Tunnel -> cloudflared (docker)
                                    -> frontend (nginx, :5173)
                                        -> app (Fastify, :3000)
                                            -> PostgreSQL + Redis
```

Tutte le comunicazioni interne: la frontend chiama `/api/*` e `ws://` passando dall'nginx che proxy-perfetta. Le porte db e redis sono esposte solo sulla rete interna di Docker.
