---
name: yupec-outbound-stack
description: Stack software per le campagne outbound Yupec — warmup, inbox management, domini
metadata:
  type: project
  updated: 2026-05-20
---

# Yupec — Stack Outbound

Software e servizi pianificati per l'infrastruttura delle campagne outbound.

## Plusvibe

**Ruolo:** warmup delle inbox. Serve a scaldare le mailbox prima di mandare email campaign, migliorando deliverability e reputazione del dominio.

Stato: da abbonare (abbonamento software + eventuale tier superiore).

## Zapmail

**Ruolo:** gestione delle inbox (inbox management). Centralizza e gestisce le caselle email usate per le campagne.

Stato: da abbonare.

## Porkbun

**Ruolo:** registrar per i domini necessari alle email delle campagne. Si comprano domini fresh su Porkbun da configurare con MX, SPF, DKIM, DMARC per le inbox.

Stato: da acquistare domini.

## Collegati

- [[yupec-outbound-tam]] — TAM e target delle campagne
- [[yupec-target-sectors]] — settori target
- [[yupec-index]] — hub progetto
