# TOOLS.md - Local Notes

Skills define _how_ tools work. This file is for _your_ specifics — the stuff that's unique to your setup.

## What Goes Here

Things like:

- Camera names and locations
- SSH hosts and aliases
- Preferred voices for TTS
- Speaker/room names
- Device nicknames
- Anything environment-specific

## Setup

### OpenClaw Web UI

Per accedere alla web UI di OpenClaw, Pietro deve aprire un tunnel SSH dal suo Mac:

```bash
ssh -L 18789:127.0.0.1:18789 pietra@100.117.95.73
```

Poi aprire nel browser (Mac): http://127.0.0.1:18789/

Il Raspberry Pi è raggiungibile via Tailscale a `100.117.95.73`, utente `pietra`.

### SSH

- raspberry → `pietra@100.117.95.73` (Tailscale), porta standard

## Why Separate?

Skills are shared. Your setup is yours. Keeping them apart means you can update skills without losing your notes, and share skills without leaking your infrastructure.

---

Add whatever helps you do your job. This is your cheat sheet.

## Related

- [Agent workspace](/concepts/agent-workspace)
