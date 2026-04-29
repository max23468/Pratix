# Pratix — Piano MVP

Gestionale web per avvocati freelance, single-user con login, estetica moderna e minimale. Quattro aree funzionali: anagrafica clienti, pratiche, rimborsi spese, fatturazione (PDF + XML FatturaPA).

> **Nota su fatturazione elettronica**: la trasmissione effettiva al SdI richiede un intermediario accreditato (Aruba, Fattura24, ecc.), firma digitale e conservazione sostitutiva decennale a norma — fuori scopo MVP. Pratix genererà il **file XML conforme al tracciato FatturaPA 1.2.2** scaricabile, pronto da trasmettere tramite il tuo intermediario di fiducia, più PDF di cortesia. L'integrazione diretta con un provider potrà essere aggiunta in v2.

## Esperienza utente

### Onboarding
- Login (email + password) e registrazione tramite Lovable Cloud.
- Al primo accesso: wizard breve per i **dati dello studio** (ragione sociale, P.IVA, codice fiscale, indirizzo, REA, cassa previdenziale, regime fiscale, IBAN, numerazione fatture iniziale, logo). Questi dati alimentano l'intestazione di ogni fattura e l'XML SdI.

### Dashboard
- Riepilogo a colpo d'occhio: pratiche attive, scadenze imminenti (prossimi 14 giorni), importi da fatturare, fatture non incassate.
- Lista delle ultime pratiche aggiornate.
- Pulsanti rapidi: Nuova pratica, Nuova fattura, Nuovo cliente.

### Clienti
- Elenco con ricerca e filtro (privato/azienda).
- Scheda cliente: anagrafica completa (nome/ragione sociale, CF, P.IVA, indirizzo, PEC, **codice destinatario SdI** a 7 caratteri, contatti) e cronologia pratiche/fatture collegate.
- PEC e codice destinatario obbligatori per i clienti che riceveranno fattura elettronica.

### Pratiche
- Elenco con filtri per stato (Aperta, In corso, Sospesa, Chiusa, Archiviata), cliente, materia (civile, penale, lavoro, famiglia, ecc.).
- Scheda pratica:
  - Dati base: numero pratica (auto), titolo, cliente, controparte, materia, autorità giudiziaria, R.G., data apertura.
  - **Stato** modificabile con timeline degli stati passati.
  - **Scadenze** (data + descrizione) con evidenza imminenti/scadute.
  - **Note** in formato testo libero.
  - **Tariffe pattuite** (forfait o a ore, eventuale acconto).
  - Tab "Spese" e "Fatture" collegate.

### Rimborsi spese
- All'interno della pratica, tab "Spese": voce con data, categoria (contributo unificato, marche da bollo, copie, trasferte, CTU, altro), descrizione, importo, flag "imponibile / anticipazione ex art. 15" (le anticipazioni in nome e per conto del cliente sono escluse da IVA).
- Riepilogo totale spese per pratica con indicatore "da fatturare / fatturate".

### Fatturazione
- Elenco fatture con stato (Bozza, Emessa, Pagata, Insoluta) e filtri per anno/cliente.
- **Creazione fattura** partendo da una pratica: precompila cliente, importa onorari pattuiti e spese non ancora fatturate (selezionabili).
- Calcoli automatici secondo prassi forense italiana:
  - Imponibile onorari
  - **Cassa Forense 4%** (configurabile) sull'imponibile
  - **IVA 22%** su (imponibile + cassa)
  - **Ritenuta d'acconto 20%** sull'imponibile (configurabile, escludibile per regime forfettario)
  - Anticipazioni ex art. 15 fuori campo IVA
  - Bollo 2 € se importo non soggetto a IVA > 77,47 €
  - Totale documento e netto a pagare
- Numerazione automatica progressiva annuale.
- **Esportazione PDF** professionale con logo, dati studio, righe, riepilogo IVA, IBAN.
- **Esportazione XML FatturaPA 1.2.2** conforme al tracciato SdI, pronto per la trasmissione tramite intermediario. Esplicitato in UI che Pratix non trasmette al SdI.
- Marcatura manuale "Pagata" con data incasso.

### Stile
Sfondo bianco, ampi spazi, tipografia sans-serif pulita (Inter), accenti in blu/indaco sobrio, bordi sottili, ombre leggere. Sidebar di navigazione fissa a sinistra (Dashboard, Clienti, Pratiche, Fatture, Impostazioni). Tabelle dense ma leggibili, stati colorati con badge tenui.

## Architettura tecnica

- **Stack**: TanStack Start + React + Tailwind + shadcn/ui (già presenti).
- **Backend**: Lovable Cloud (Supabase) per auth (email/password) e database.
- **Routing**: route file separate sotto `src/routes/_authenticated/` per le pagine protette (dashboard, clienti, pratiche, fatture, impostazioni); `/login`, `/register` pubbliche.
- **Schema DB principali** (tutte con RLS scoping su `auth.uid()`):
  - `profiles` (1:1 con `auth.users`) → dati studio
  - `clients` → anagrafica
  - `cases` (pratiche) + `case_status_history` + `case_deadlines`
  - `expenses` → spese per pratica
  - `invoices` + `invoice_lines`
- **Generazione PDF**: lato client con `jspdf` per evitare vincoli del runtime serverless.
- **Generazione XML FatturaPA**: server function TanStack che produce XML 1.2.2 (testata, cedente/prestatore, cessionario/committente, dati generali documento, dettaglio linee, riepilogo IVA), restituito come download.
- Validazione input con Zod sia lato client che server.

## Fuori scopo (v2)
- Trasmissione effettiva al SdI e ricezione notifiche.
- Conservazione sostitutiva a norma decennale.
- Multi-utente / studio condiviso.
- Calendario integrato e notifiche scadenze via email.
- Time tracking a ore.
- Riconciliazione bancaria automatica.

## Approccio di consegna
1. Setup Lovable Cloud + auth + schema DB + RLS + wizard dati studio.
2. CRUD clienti e pratiche con stato e scadenze.
3. Spese collegate alle pratiche.
4. Fatturazione: creazione, calcoli, PDF.
5. Export XML FatturaPA.
6. Dashboard riepilogativa.

Confermi di procedere con questo perimetro? Se sì, passo in modalità build e parto dal punto 1.
