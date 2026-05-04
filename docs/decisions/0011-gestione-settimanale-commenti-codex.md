# ADR 0011 — Gestione settimanale commenti Codex

- **Stato**: Accettato
- **Data**: 2026-05-02
- **Decisori**: Matteo / Codex

## Contesto

Le review automatiche di Codex su GitHub possono lasciare thread inline utili
ma facili da perdere, soprattutto quando si aprono piu PR operative in sequenza.
Serve un controllo periodico dentro il repository, non legato a un'automazione
esterna di Codex, che analizzi il lavoro ancora aperto senza riattivare PR gia
chiuse o mergiate.

## Decisione

Aggiungiamo un workflow GitHub Actions settimanale nel repository Pratix.

Il workflow:

- gira ogni lunedi;
- legge `.github/codex-pr-scan-state.json`;
- analizza tutte le PR (aperte, chiuse e mergiate);
- cerca tutti i thread di review con commenti del bot Codex, anche se risolti o
  outdated;
- trascrive lo stato corrente in `.github/codex-pr-pending-comments.md` con elenco
  delle PR analizzate e checklist dei thread Codex rilevati;
- pubblica un commento `@codex address that feedback` sulle PR interessate;
- aggiorna lo stato salvato nel repo con il numero massimo visto, senza usare
  quello stato per riaprire PR chiuse o mergiate.

La baseline iniziale parte da PR #5 perche le PR #1-#5 sono gia state esaminate
manualmente.

## Conseguenze

- I commenti Codex non restano affidati alla memoria o alla lettura manuale
  delle notifiche email.
- Il controllo resta versionato e revisionabile come parte di Pratix.
- Lo stato pending diventa leggibile in un file Markdown unico, utile come gate
  operativo prima della pubblicazione.
- Per evitare scansioni ridondanti, ogni PR viene controllata due volte e saltata
  automaticamente al terzo giro settimanale.
- Il workflow produce piccoli commit di stato quando trova PR aperte nuove da
  registrare.
- L'efficacia dell'intervento dipende dal fatto che Codex risponda al commento
  `@codex address that feedback` pubblicato dal workflow GitHub Actions.

## Alternative considerate

- **Automazione esterna Codex** — Scartata: il controllo sarebbe fuori dal repo
  e meno visibile.
- **Riesaminare sempre tutte le PR** — Scartata: genera rumore e rischia di
  riaprire lavoro gia valutato. Il controllo resta limitato alle PR aperte.
- **Disabilitare Codex review** — Scartata: i commenti sono utili, il problema
  e intercettarli e gestirli.

## Riferimenti

- [`.github/workflows/codex-pr-comments.yml`](../../.github/workflows/codex-pr-comments.yml)
- [`.github/scripts/handle-codex-pr-comments.mjs`](../../.github/scripts/handle-codex-pr-comments.mjs)
- [`.github/codex-pr-scan-state.json`](../../.github/codex-pr-scan-state.json)
- [`.github/codex-pr-pending-comments.md`](../../.github/codex-pr-pending-comments.md)
