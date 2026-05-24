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
- **Cassa Forense 4%** esposta in fattura sui compensi, senza IVA
- Imposta sostitutiva versata dal professionista, non in fattura
- Soglia ricavi attuale: 85.000 € (verificare normativa vigente)

### Regime ordinario

- IVA al **22%** sull'imponibile
- **Ritenuta d'acconto 20%** sull'imponibile, se il committente è **sostituto d'imposta** (azienda, partita IVA, ente)
- No ritenuta verso committenti persone fisiche private

## Cassa Forense

- **Contributo integrativo (CPA) 4%** in fattura, applicato a compensi +
  spese generali quando abilitate, addebitato al committente.
- Concorre alla base imponibile IVA nel regime ordinario; nel forfettario non c'è IVA.
- I rimborsi spese del flusso recupero crediti sono sempre anticipazioni
  Art. 15 e non entrano nella base cassa.
- Il **contributo soggettivo** è del professionista, **non** entra in fattura.

## Calcoli (regime ordinario)

```
compensi           = somma attività di tipo compenso
spese_generali     = compensi * 0.10           (solo se flag attivo)
base_cassa         = compensi + spese_generali
contributo_cpa     = base_cassa * 0.04
base_iva           = base_cassa + contributo_cpa
iva                = base_iva * 0.22
ritenuta_acconto   = base_cassa * 0.20         (se committente sostituto d'imposta)
rimborsi_art15     = somma rimborsi spese
bollo              = 2.00                    (solo se abilitato e sopra soglia)
totale_documento   = base_iva + iva + rimborsi_art15 + bollo
netto_a_pagare     = totale_documento - ritenuta_acconto
```

## Calcoli (regime forfettario)

```
compensi           = somma attività di tipo compenso
spese_generali     = compensi * 0.10           (solo se flag attivo)
base_cassa         = compensi + spese_generali
contributo_cpa     = base_cassa * 0.04
rimborsi_art15     = somma rimborsi spese
bollo              = 2.00                    (solo se abilitato e sopra soglia)
totale_documento   = base_cassa + contributo_cpa + rimborsi_art15 + bollo
netto_a_pagare     = totale_documento
```

## Bollo

- Il bollo è disattivo di default.
- Si abilita da _Impostazioni → Fatturazione → Bollo_.
- Quando è disattivo non viene addebitato, non entra nei totali e non compare
  nel riepilogo della fattura.
- Quando è attivo, Pratix addebita 2 € solo se la fattura supera la soglia
  prevista per rimborsi Art. 15 o, in regime forfettario, per il totale imponibile
  con Cassa Forense.

## Numerazione

- Numerazione progressiva annuale, reset a inizio anno.
- Configurabile in _Impostazioni → Numerazione_.

## Bozze e Attività

- Salvare una bozza collega le Attività alla fattura, ma non le marca come
  fatturate.
- Le Attività incluse diventano fatturate solo quando la fattura viene emessa.
- Riportare una fattura emessa in bozza mantiene il collegamento alla fattura e
  riporta le Attività nello stato operativo di bozza.
- Emissione e ritorno in bozza usano la RPC `set_invoice_issue_state`, che
  aggiorna Fattura e Attività collegate nella stessa transazione database.

## Ricezione committente (codice destinatario / PEC)

- **Codice destinatario** SDI: 7 caratteri.
- Se il committente non ha un codice, si usa `0000000` e si valorizza la **PEC**.
- Per privati senza PEC né codice: `0000000` + e-mail nel campo descrittivo (la fattura va in cassetto fiscale del committente).

## Cosa Pratix oggi fa

| Capacità                         | Stato           |
| -------------------------------- | --------------- |
| Generazione XML FatturaPA TD06   | ✅              |
| Generazione PDF di cortesia      | ✅              |
| Calcoli forfettario / ordinario  | ✅              |
| Cassa Forense 4%                 | ✅              |
| Bollo opzionale                  | ✅              |
| Ritenuta d'acconto condizionata  | ✅              |
| Numerazione progressiva          | ✅              |
| Fatturazione committente/periodo | ✅              |
| Rendiconti Excel compensi/spese  | ✅              |
| Esportazione massiva ZIP         | ✅              |
| Invio diretto SDI                | ⬜ (ADR aperto) |

## File rilevanti

- `src/lib/invoice-xml.ts` — costruzione XML
- `src/lib/invoice-pdf.ts` — generazione PDF (jsPDF)
- `src/lib/invoice-file-exports.ts` — ZIP PDF + XML per export massivo
- `src/components/invoice-form.tsx` — generazione fattura da attività
- `src/routes/fatture.*.tsx` — UI lista e dettaglio

## Errori frequenti

- **"Partita IVA mancante"**: configurare in Impostazioni → Professione.
- **Codice destinatario sbagliato**: usare `0000000` se assente, mai stringa vuota.
- **Cliente persona fisica con ritenuta**: non si applica ritenuta, è errore.
