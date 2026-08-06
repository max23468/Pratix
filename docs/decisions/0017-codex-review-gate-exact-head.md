# ADR 0017 — Gate Codex review exact-HEAD

- **Stato**: Accettato
- **Data**: 2026-08-06

## Contesto

La precedente feedback inbox aggregava thread Codex ma non forniva un check
required associato all'esatto HEAD della PR. Poteva quindi conservare segnali
obsoleti senza bloccare direttamente il merge del commit corrente.

## Decisione

Usare un unico status `codex-review`, pubblicato sull'HEAD corrente da un
workflow `pull_request_target` che esegue soltanto codice del branch
predefinito. Approvazioni, finding ed errori devono essere attribuibili allo
stesso SHA e al tentativo corrente; i finding P0-P3 prevalgono sempre.

La feedback inbox, i suoi workflow, script, test e ADR precedenti vengono
rimossi. La protezione di `main` richiede `codex-review` insieme ai check già
esistenti, senza bypass aggiuntivi.

## Conseguenze

- ogni nuovo SHA invalida le prove precedenti;
- il workflow può restare verde mentre lo status blocca il merge;
- la PR di bootstrap viene verificata con review esplicita, poi il gate viene
  attivato e provato dal branch predefinito dopo il merge.
