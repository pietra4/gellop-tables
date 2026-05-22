---
name: openclaw-access
description: Come Pietro accede alla web UI di OpenClaw — tunnel SSH obbligatorio
metadata:
  type: reference
---

# Accesso OpenClaw Web UI

**IMPORTANTISSIMO** — La UI gira sul Raspberry Pi e non è esposta direttamente.

## Procedura

1. Aprire tunnel SSH dal Mac:
   ```bash
   ssh -L 18789:127.0.0.1:18789 pietra@100.117.95.73
   ```
2. Aprire nel browser Mac: http://127.0.0.1:18789/

## Dettagli infrastruttura

- Raspberry Pi accessibile via Tailscale: `100.117.95.73`
- Utente SSH: `pietra`
- Porta OpenClaw: `18789`
