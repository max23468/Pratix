# ADR 0011 — Gestione settimanale commenti Codex

- **Stato**: Accettato
- **Data**: 2026-05-02
- **Decisori**: Matteo / Codex

## Contesto

Le review automatiche di Codex su GitHub possono lasciare thread inline utili
ma facili da perdere, soprattutto quando una PR viene mergeata o quando si
aprono piu PR operative in sequenza. Serve un controllo periodico dentro il
repository, non legato a un'automazione esterna di Codex, che analizzi solo il
lavoro nuovo e non ripassi ogni settimana le stesse PR gia viste.

## Decisione

Aggiungiamo un workflow GitHub Actions settimanale nel repository Pratix.

Il workflow:

- gira ogni lunedi;
- legge `.github/codex-pr-scan-state.json`;
- analizza solo le PR con numero maggiore di `lastPrNumber`;
- cerca thread di review Codex non risolti e non outdated;
- pubblica un commento `@codex address that feedback` sulle PR interessate;
- aggiorna lo stato salvato nel repo, cosi la settimana successiva prosegue
  dalle PR successive.

La baseline iniziale parte da PR #5 perche le PR #1-#5 sono gia state esaminate
manualmente.

## Conseguenze

- I commenti Codex non restano affidati alla memoria o alla lettura manuale
  delle notifiche email.
- Il controllo resta versionato e revisionabile come parte di Pratix.
- Il workflow produce piccoli commit di stato quando trova nuove PR da
  registrare.
- L'efficacia dell'intervento dipende dal fatto che Codex risponda al commento
  `@codex address that feedback` pubblicato dal workflow GitHub Actions.

## Alternative considerate

- **Automazione esterna Codex** — Scartata: il controllo sarebbe fuori dal repo
  e meno visibile.
- **Riesaminare sempre tutte le PR** — Scartata: genera rumore e rischia di
  riaprire lavoro gia valutato.
- **Disabilitare Codex review** — Scartata: i commenti sono utili, il problema
  e intercettarli e gestirli.

## Riferimenti

- [`.github/workflows/codex-pr-comments.yml`](../../.github/workflows/codex-pr-comments.yml)
- [`.github/scripts/handle-codex-pr-comments.mjs`](../../.github/scripts/handle-codex-pr-comments.mjs)
- [`.github/codex-pr-scan-state.json`](../../.github/codex-pr-scan-state.json)
