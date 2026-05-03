# ADR 0005 — Target esplicito freelance: vietata la parola "studio"

> Nota 2026-05-03: [ADR 0013](./0013-focus-recupero-crediti.md) mantiene il
> target freelance ma aggiorna i vincoli lessicali. "Studio" non e piu vietata
> in assoluto, mentre "attivita" diventa termine centrale per le voci operative
> e fatturabili della pratica.

- **Stato**: Accettato
- **Data**: 2026-04-29

## Contesto

Il mercato dei gestionali per avvocati in Italia è dominato da prodotti pensati per **studi associati**: linguaggio plurale ("noi dello studio"), ruoli multipli, gerarchie, cartelle condivise. Questo crea due problemi al freelance singolo:

1. La UI è inutilmente complessa (ruoli, permessi, deleghe).
2. Il copy lo fa sentire fuori posto ("il vostro studio", "i collaboratori dello studio").

Pratix ha scelto come target il **professionista singolo**. La parola "studio" è quindi lessicalmente sbagliata.

## Decisione

La parola **"studio"** è **vietata** in tutta la UI di Pratix (label, microcopy, meta tag, errori, onboarding, fallback fatture).

Sostituzioni canoniche:

| Vecchio                          | Nuovo                                      |
| -------------------------------- | ------------------------------------------ |
| "il tuo studio"                  | "la tua professione"                       |
| "dati dello studio"              | "i tuoi dati professionali", "i tuoi dati" |
| "Tab: Studio"                    | "Tab: Professione"                         |
| "Ragione sociale / Studio"       | "Ragione sociale / Denominazione"          |
| Fallback fattura "Studio Legale" | "Avvocato"                                 |

> **Nota (2026-04-29)**: la parola **"attività"** — usata in una prima versione di questo ADR come sostituto di "studio" — è anch'essa stata **dismessa** perché ambigua in italiano (significa sia "impresa" sia "azione/task", e in Pratix indica già le voci di lavoro fatturabili). Il termine canonico è ora **"professione"** / "i tuoi dati professionali". "Attività" resta lecita solo come sostantivo comune ("le attività compiute tramite l'account") nei testi legali, mai come label di prodotto.

L'unico contesto ammesso per "studio" è **dentro nomi liberi inseriti dall'utente** (es. `business_name = "Studio Legale Rossi & Partners"`): il software non li riscrive.

## Conseguenze

- ✅ Posizionamento chiaro e differenziante: "Pratix è per il freelance".
- ✅ Tono coerente in tutto il prodotto.
- ✅ Nessuna ambiguità: "professione", "i tuoi dati professionali" funzionano sia per il forfettario sia per l'ordinario, e non collidono con "attività" intesa come task.
- ⚠️ Se in futuro vorremo entrare nel segmento studi associati, dovremo ripensare lessico, ruoli, permessi e questo ADR andrà sostituito.
- ⚠️ I revisori (umani o agenti) devono memorizzare la regola: ogni nuova stringa va controllata.

## Alternative considerate

- **Permettere "studio" come sinonimo neutro** — ambiguo, fa scivolare il prodotto verso il segmento sbagliato.
- **Usare "ufficio" o "studio professionale"** — peggio, rievoca lo stesso immaginario.
- **Brandizzare senza lessico funzionale** ("la tua Pratix") — fuorviante.

## Riferimenti

- [`docs/guides/tono-di-voce.md`](../guides/tono-di-voce.md)
- [`docs/glossario.md`](../glossario.md)
- [`BRAND.md`](../../BRAND.md)
