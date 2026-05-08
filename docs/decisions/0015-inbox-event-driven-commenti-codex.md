# ADR 0015 — Inbox event-driven commenti Codex

- **Stato**: Accettato
- **Data**: 2026-05-08
- **Decisori**: Matteo / Codex

## Contesto

Il workflow settimanale dei commenti Codex creava un ritardo operativo e
manteneva stato committato nel repository. Questo produceva rumore su `main` e
rendeva poco chiara la differenza fra commenti actionable, commenti già risolti
e thread outdated.

Serve un flusso immediato: quando arriva feedback Codex su GitHub, il progetto
deve trasformarlo subito in lavoro operativo e, nello stesso passaggio,
controllare anche i commenti Codex storici.

## Decisione

Sostituiamo la gestione settimanale con un workflow GitHub Actions event-driven.

Il workflow:

- parte su eventi PR in contesto trusted, sincronizzazioni/chiusure PR e
  commenti issue, oltre che manualmente via `workflow_dispatch`;
- mantiene una scansione programmata ogni 6 ore per riallineare la inbox quando
  lo stato dei review thread cambia senza creare o modificare commenti, per
  esempio dopo una risoluzione o riapertura;
- analizza tutte le PR del repository, aperte, chiuse e mergiate;
- usa i review thread GitHub come fonte di verità;
- aggiorna una issue unica chiamata `Codex feedback inbox`;
- chiude automaticamente eventuali issue inbox duplicate, mantenendo una sola
  issue canonica;
- separa i thread actionable (`resolved=no`, `outdated=no`) dallo storico;
- mostra lo storico in forma compatta, con limiti configurabili, per evitare che
  la issue diventi rumorosa;
- pubblica `@codex address that feedback` sulle PR con thread actionable, senza
  duplicare richieste già pubblicate per gli stessi thread;
- esegue sempre lo script dalla default branch, non dal merge ref della PR che ha
  generato l'evento, così il token con `issues: write` non esegue codice proposto
  nella PR;
- usa scansioni mirate su eventi ordinari (PR aperte, PR recenti e PR
  dell'evento) e conserva la scansione completa per schedule, dispatch manuale e
  commenti sulla inbox;
- non committa più file di stato o report Markdown nel repository.

La issue inbox è il punto operativo da controllare prima di dichiarare pronta una
PR o una pubblicazione.

## Conseguenze

- I commenti Codex vengono intercettati appena arrivano, senza attendere il
  lunedì.
- La inbox viene ripulita dopo la risoluzione o riapertura dei thread anche se
  GitHub Actions non espone un trigger valido per quello stato: la scansione
  programmata ogni 6 ore riallinea `isResolved`.
- La issue inbox resta unica anche dopo run ravvicinati: eventuali duplicati
  aperti vengono commentati e chiusi come duplicati della canonica.
- Lo storico resta disponibile ma non cresce senza controllo nel corpo della
  issue.
- Gli eventi ordinari consumano meno API perché non attraversano sempre tutto lo
  storico PR; la scansione completa resta disponibile nei punti di
  riallineamento.
- Il workflow sacrifica la possibilità di testare modifiche allo script dalla PR
  stessa in cambio dell'esecuzione di codice trusted con permessi di scrittura
  sulla issue inbox.
- I commenti inline di review non attivano più un workflow con token write da
  YAML della PR: vengono intercettati dal successivo evento trusted, dal dispatch
  manuale o dalla scansione programmata.
- `main` non riceve più commit automatici di solo stato.
- Il backlog storico resta visibile, ma non viene confuso con il lavoro da fare
  subito.
- Le PR chiuse o mergiate vengono comunque analizzate; se contengono thread
  actionable, Codex viene richiamato e potrà aprire un follow-up se la PR non è
  più modificabile.
- Il checkout del workflow resta fissato al default branch, così il token con
  permesso `issues: write` non esegue script modificati dentro una PR.
- GitHub Actions non espone un trigger dedicato al solo click "Resolve
  conversation"; se un thread viene risolto senza push o commenti, la inbox si
  aggiorna al successivo evento o con dispatch/commento manuale.
- I commenti GitHub in stato pending non pubblicato restano fuori portata delle
  API finché la review non viene inviata.

## Alternative considerate

- **Mantenere il workflow settimanale** — Scartata: troppo lento e rumoroso.
- **File Markdown committato come inbox** — Scartata: lo stato GitHub non deve
  sporcare il repository.
- **Solo commento sticky su ogni PR** — Scartata: non offre una vista unica del
  backlog storico.

## Riferimenti

- [`.github/workflows/codex-pr-comments.yml`](../../.github/workflows/codex-pr-comments.yml)
- [`.github/scripts/handle-codex-pr-comments.mjs`](../../.github/scripts/handle-codex-pr-comments.mjs)
