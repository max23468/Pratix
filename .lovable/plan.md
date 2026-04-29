## Modulo Fatturazione - Piano di implementazione

Implemento il modulo completo Fatturazione con calcoli fiscali italiani, generazione PDF e XML FatturaPA 1.2.2.

### 1. Logica di calcolo (`src/lib/invoice-calc.ts`)

Funzione `computeInvoice(lines, options)` che calcola:
- **Imponibile compensi** (somma righe `fee` + `expense_taxable`)
- **Cassa Forense** = imponibile × 4% (configurabile da profilo)
- **Imponibile IVA** = imponibile + cassa
- **IVA** = imponibile IVA × 22% (configurabile)
- **Ritenuta d'acconto** = imponibile × 20% (se `apply_withholding` e regime ordinario)
- **Spese Art. 15** (anticipazioni escluse IVA, escluse ritenuta)
- **Bollo** = €2,00 se Art. 15 > €77,47 oppure se regime forfettario con totale > €77,47
- **Totale documento** e **Netto a pagare**

### 2. Numerazione automatica
Server function `getNextInvoiceNumber` che legge `profiles.invoice_year` / `invoice_next_number` / `invoice_number_prefix` e incrementa atomicamente all'emissione.

### 3. Form fattura (`src/components/invoice-form.tsx`)
- Selezione cliente (con autocomplete) e pratica opzionale
- Data emissione, scadenza, stato
- Righe dinamiche con tipo (`fee`, `expense_taxable`, `expense_art15`)
- Possibilità di importare spese pendenti dalla pratica selezionata
- Pannello laterale con riepilogo calcoli live (cassa, IVA, ritenuta, bollo, totale, netto)
- Toggle ritenuta, override aliquote per la singola fattura

### 4. Pagine
- `src/routes/fatture.index.tsx`: lista con filtri stato/anno/cliente, badge colorati, totali periodo
- `src/routes/fatture.nuova.tsx`: form creazione (riusa `invoice-form`)
- `src/routes/fatture.$invoiceId.tsx`: dettaglio + modifica + azioni (segna pagata, duplica, elimina, scarica PDF, scarica XML)

### 5. Generazione PDF (`src/lib/invoice-pdf.ts`)
Client-side con `jspdf` + `jspdf-autotable`:
- Intestazione studio (da `profiles`: ragione sociale, P.IVA, CF, indirizzo, IBAN, ordine)
- Dati cliente
- Tabella righe
- Riepilogo fiscale
- Coordinate bancarie e note

### 6. Generazione XML FatturaPA 1.2.2
Server function `generateInvoiceXml` in `src/server/invoices.functions.ts`:
- Compone `FatturaElettronica` v1.2.2 con namespace corretti
- Header: `DatiTrasmissione` (CodiceDestinatario o `0000000` + PEC), `CedentePrestatore`, `CessionarioCommittente`
- Body: `DatiGenerali` (TD06 parcella), `DatiBeniServizi` con righe e `DatiCassaPrevidenziale`, `DatiRitenuta`, `DatiBollo`, `DatiPagamento`
- Validazione campi obbligatori (P.IVA cliente o CF, SDI/PEC)
- Restituisce XML come string per download

Nome file: `IT{piva}_{progressivo}.xml`

### 7. Navigazione
Aggiorno `app-sidebar.tsx` (la voce Fatture esiste già, attivo le sottovoci) e rimuovo i `coming-soon` placeholder.

### Dettagli tecnici
- Tutte le mutation passano da `useMutation` di TanStack Query con invalidazione cache
- Stati fattura: `draft`, `issued`, `paid`, `cancelled` con transizioni controllate
- Validazione form con `zod` + `react-hook-form` (già presenti)
- I totali calcolati vengono persistiti su `invoices` (campi già presenti) per coerenza con la lista
- Trigger DB per `updated_at` già attivo

### File da creare
- `src/lib/invoice-calc.ts`
- `src/lib/invoice-pdf.ts`
- `src/lib/invoice-xml.ts` (helper puro, importato dal server)
- `src/server/invoices.functions.ts`
- `src/components/invoice-form.tsx`
- `src/components/invoice-line-row.tsx`
- `src/components/invoice-summary.tsx`
- `src/routes/fatture.$invoiceId.tsx`

### File da modificare
- `src/routes/fatture.index.tsx` (sostituisce coming-soon)
- `src/routes/fatture.nuova.tsx` (sostituisce coming-soon)

Confermi per procedere?
