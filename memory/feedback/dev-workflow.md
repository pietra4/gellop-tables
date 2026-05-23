---
name: feedback-dev-workflow
description: Regola operativa permanente per i progetti di sviluppo con Pietro
metadata:
  type: feedback
---

Quando lavoriamo su un progetto di sviluppo, la versione nuova va sempre caricata su GitHub alla fine del lavoro e va sempre verificato che il push sia andato davvero a buon fine confrontando `HEAD` locale e `origin/master`.

Quando Pietro chiede un progetto “finito”, non bisogna fermarsi a step/iterazioni dichiarate: si continua a iterare fino a completezza 100% percepita dall'utente, poi si pusha.

Prima del push finale di un progetto finito, anche la documentazione di progetto va aggiornata e allineata alle modifiche reali (README/CHANGELOG/ARCHITECTURE/VERIFICATION quando pertinente).

Se il push non funziona, la procedura standard non è fermarsi: bisogna fare subito login GitHub nella sessione corrente e poi riprovare il push fino a conferma.

Per evitare di perdere la sessione come nel primo tentativo, usare un path di config scrivibile nella sessione (`XDG_CONFIG_HOME=/tmp/ghcfg`) e poi:

`gh auth login --hostname github.com --git-protocol https --web --insecure-storage`

Dopo autorizzazione device flow, eseguire:

`gh auth setup-git`

Poi fare push e verifica finale:

`git push origin master`

`git rev-parse HEAD` deve combaciare con `git ls-remote --heads origin master`.
