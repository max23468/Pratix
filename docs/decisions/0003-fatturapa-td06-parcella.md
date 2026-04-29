# ADR 0003 — FatturaPA: tipo documento TD06 (Parcella)

- **Stato**: Accettato
- **Data**: 2026-04-29

## Contesto

La fatturazione elettronica in Italia è obbligatoria via Sistema di Interscambio (SDI) con XML FatturaPA. I tipi documento ammessi includono `TD01` (fattura), `TD06` (parcella), e altri.

Il target di Pratix è l'**avvocato freelance**, che emette **prestazioni professionali**. Le specifiche FatturaPA prevedono per le prestazioni professionali il tipo **TD06 — Parcella**.

## Decisione

Pratix genera fatture elettroniche con `TipoDocumento = TD06` (Parcella), schema FatturaPA versione 1.2.2.

Implementazione in `src/lib/invoice-xml.ts`. PDF di cortesia in `src/lib/invoice-pdf.ts`.

L'invio diretto allo SDI **non** è incluso in questa decisione: oggi Pratix genera il file XML, l'invio resta a carico del professionista o del suo intermediario (commercialista, servizio terzo). Sarà oggetto di un ADR futuro.

## Conseguenze

- ✅ Conformità con la prassi e con le aspettative dei commercialisti.
- ✅ XML accettato senza scarti di tipo documento.
- ⚠️ Se in futuro entreremo in altri segmenti (es. agenzie, società) potremmo dover supportare anche `TD01`. Sarà un nuovo ADR.
- 🔁 Da rivedere se Pratix diventerà punto di invio diretto SDI: serve canale autorizzato, certificato, monitoraggio scarti/notifiche.

## Alternative considerate

- **TD01 (Fattura)** — non corretto per prestazioni professionali di un avvocato.
- **Generare solo PDF** — non conforme alla normativa.
- **Delegare la generazione a un servizio terzo** (es. FattureInCloud API) — toglierebbe controllo su un cuore del prodotto.

## Riferimenti

- [`docs/guides/fatturazione.md`](../guides/fatturazione.md)
- [`docs/glossario.md`](../glossario.md)
- Specifiche tecniche FatturaPA — Agenzia delle Entrate
