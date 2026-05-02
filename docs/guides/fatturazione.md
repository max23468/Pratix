# Guida — Fatturazione (FatturaPA, regimi, calcoli)

Tutto il know-how fiscale e tecnico per capire come Pratix produce fatture conformi.

## Vincoli normativi (sintesi operativa)

> Non costituisce consulenza fiscale. Per il dettaglio normativo aggiornato, riferirsi alle specifiche tecniche FatturaPA dell'Agenzia delle Entrate.

- Le fatture verso PA, B2B e B2C in Italia sono **elettroniche obbligatorie** (XML FatturaPA via SDI).
- Per gli avvocati il tipo documento è **TD06 — Parcella**.
- Il file XML deve rispettare lo schema FatturaPA versione **1.2.2**.

## Tipo documento e standard

- **Standard**: FatturaPA v1.2.2
- **Tipo documento**: `TD06` (Parcella) — vedi [ADR 0003](../decisions/0003-fatturapa-td06-parcella.md)
- **Generazione**: `src/lib/invoice-xml.ts`
- **PDF di cortesia**: `src/lib/invoice-pdf.ts`

Pratix oggi **genera** il file XML; **non** lo invia ancora a SDI (vedi roadmap).

## Regimi fiscali supportati

### Regime forfettario

- Imponibile uguale al totale della prestazione
- **Niente IVA** (operazione fuori campo IVA, art. 1 c. 54-89 L. 190/2014)
- **Niente ritenuta d'acconto** in fattura
- Imposta sostitutiva versata dal professionista, non in fattura
- Soglia ricavi attuale: 85.000 € (verificare normativa vigente)

### Regime ordinario

- IVA al **22%** sull'imponibile
- **Ritenuta d'acconto 20%** sull'imponibile, se il cliente è **sostituto d'imposta** (azienda, partita IVA, ente)
- No ritenuta verso persone fisiche private

## Cassa Forense

- **Contributo integrativo (CPA) 4%** in fattura, applicato sull'imponibile, addebitato al cliente.
- Concorre alla base imponibile IVA nel regime ordinario; nel forfettario non c'è IVA.
- Il **contributo soggettivo** è del professionista, **non** entra in fattura.

## Calcoli (regime ordinario)

```
imponibile         = somma righe parcella
contributo_cpa     = imponibile * 0.04
base_iva           = imponibile + contributo_cpa
iva                = base_iva * 0.22
ritenuta_acconto   = imponibile * 0.20         (se cliente sostituto d'imposta)
totale_documento   = base_iva + iva
netto_a_pagare     = totale_documento - ritenuta_acconto
```

## Calcoli (regime forfettario)

```
imponibile         = somma righe parcella
contributo_cpa     = imponibile * 0.04
totale_documento   = imponibile + contributo_cpa
netto_a_pagare     = totale_documento
```

## Numerazione

- Numerazione progressiva annuale, reset a inizio anno.
- Configurabile in _Impostazioni → Numerazione_.

## Ricezione cliente (codice destinatario / PEC)

- **Codice destinatario** SDI: 7 caratteri.
- Se il cliente non ha un codice, si usa `0000000` e si valorizza la **PEC**.
- Per privati senza PEC né codice: `0000000` + e-mail nel campo descrittivo (la fattura va in cassetto fiscale del cliente).

## Cosa Pratix oggi fa

| Capacità                        | Stato           |
| ------------------------------- | --------------- |
| Generazione XML FatturaPA TD06  | ✅              |
| Generazione PDF di cortesia     | ✅              |
| Calcoli forfettario / ordinario | ✅              |
| Cassa Forense 4%                | ✅              |
| Ritenuta d'acconto condizionata | ✅              |
| Numerazione progressiva         | ✅              |
| Esportazione massiva ZIP        | ⬜              |
| Invio diretto SDI               | ⬜ (ADR aperto) |

## File rilevanti

- `src/lib/invoice-xml.ts` — costruzione XML
- `src/lib/invoice-pdf.ts` — generazione PDF (jsPDF)
- `src/components/invoice-form.tsx` — UI editor fattura
- `src/routes/fatture.*.tsx` — UI lista e dettaglio

## Errori frequenti

- **"Partita IVA mancante"**: configurare in Impostazioni → Professione.
- **Codice destinatario sbagliato**: usare `0000000` se assente, mai stringa vuota.
- **Cliente persona fisica con ritenuta**: non si applica ritenuta, è errore.
