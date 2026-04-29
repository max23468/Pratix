# ADR 0005 — Target esplicito freelance: vietata la parola "studio"

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

| Vecchio | Nuovo |
|---|---|
| "il tuo studio" | "la tua attività", "la tua attività professionale" |
| "dati dello studio" | "i tuoi dati", "i tuoi dati professionali" |
| "Tab: Studio" | "Tab: Attività" |
| "Ragione sociale / Studio" | "Ragione sociale / Denominazione" |
| Fallback fattura "Studio Legale" | "Avvocato" |

L'unico contesto ammesso è **dentro nomi liberi inseriti dall'utente** (es. `business_name = "Studio Legale Rossi & Partners"`): il software non li riscrive.

## Conseguenze

- ✅ Posizionamento chiaro e differenziante: "Pratix è per il freelance".
- ✅ Tono coerente in tutto il prodotto.
- ✅ Nessuna ambiguità: "attività", "i tuoi dati" funzionano sia per il forfettario sia per l'ordinario.
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
