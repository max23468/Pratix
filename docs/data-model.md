# Modello dati di Pratix

> Documento narrativo, leggibile senza accesso diretto al database. La sorgente di
> verità SQL è [`../supabase/schema.sql`](../supabase/schema.sql); questo file
> spiega **cosa** rappresentano le tabelle e **perché** sono fatte così.

Aggiornato a: **Fase 2 recupero crediti** + migration
`20260503202905_phase_2_debt_collection_schema`.

## Principi generali

1. **Multi-tenancy via `user_id`**, non via schema separato. Ogni tabella
   user-owned ha una colonna `user_id uuid` che corrisponde all'`auth.uid()`
   dell'avvocato proprietario. Nessuna tabella è condivisa fra utenti diversi.

2. **RLS sempre attiva**. Ogni tabella user-owned ha quattro policy
   (`select`, `insert`, `update`, `delete`) tutte basate su
   `(select auth.uid()) = user_id`, così Postgres valuta l'utente una sola
   volta per statement. L'unica eccezione è `case_status_history`, che ha solo
   `select` e `insert` perché lo storico per definizione non si modifica né si
   elimina.

3. **`profiles` segue `auth.users`**. La PK di `profiles` (`id`) è la stessa
   `id` di `auth.users`, non una colonna `user_id` separata. Una riga viene
   creata automaticamente al primo signup dal trigger `handle_new_user`.

4. **Foreign key dichiarate** per le relazioni operative principali. Le tabelle
   utente referenziano `auth.users(id)`; le relazioni fra committenti, clienti,
   controparti, pratiche, prezzi, attività e fatturazione usano foreign key
   composite `(id, user_id)` quando serve evitare collegamenti fra proprietari
   diversi.

5. **RLS resta la barriera applicativa**. Le foreign key proteggono la coerenza
   dei dati, mentre l'accesso alle righe continua a dipendere dalle policy
   `(select auth.uid()) = user_id`.

## Tabelle

### `profiles`

Profilo professionale dell'avvocato (1:1 con `auth.users`).

Contiene tre famiglie di dati:

- **Anagrafica e fiscale**: nome, business name (denominazione attività), CF,
  P.IVA, REA, ordine professionale, indirizzo.
- **Configurazione fatturazione**: regime fiscale, aliquote di default
  (cassa, IVA, ritenuta), IBAN, prefisso e contatore numerazione fatture.
- **Stato applicazione**: `onboarding_completed`,
  `last_seen_changelog_version` (per la campanella "Novità"), `logo_url`.

### `user_table_preferences`

Preferenze UI sincronizzate fra dispositivi per l'utente autenticato. Ogni riga
identifica una sezione tabellare (`section`) e l'ultimo ordinamento scelto
(`sort_key`, `sort_direction`). Le policy RLS limitano lettura e scrittura al
proprietario della riga.

### Codici pubblici stabili

Le tabelle operative principali (`clients`, `principals`, `counterparties`,
`cases`, `price_books`, `invoices`) espongono un `public_code` univoco per
utente, pensato per URL leggibili e riferimenti non sensibili. I prefissi sono:
`CL` per clienti, `CM` per committenti, `CP` per controparti, `PR` per pratiche,
`PZ` per prezzi e `FT` per fatture. Il trigger `assign_public_code` preserva i
codici già assegnati e genera il prossimo progressivo in modo atomico.

### `clients`

Rubrica clienti dell'avvocato. Nel nuovo dominio recupero crediti il cliente è
il soggetto per cui viene gestita la posizione creditoria, mentre la fattura
viene emessa al committente. `kind` distingue persona fisica (`individual`) da
soggetto giuridico (`company`); a seconda del tipo si valorizzano
`first_name`+`last_name` o `business_name`.

Contiene solo dati anagrafici e di contatto utili alla pratica: i campi fiscali,
PEC e codice destinatario SDI vivono sui committenti, perché sono i soli
destinatari della fattura.

La stessa anagrafica cliente può essere collegata a più committenti tramite
`principal_clients`.

### `principals`

Committenti. Sono i soggetti a cui l'avvocato emette fattura e che hanno uno o
più clienti collegati.

Oltre ai dati fiscali e di contatto, contengono:

- `fees_enabled`: abilita o disabilita i compensi per quel committente;
- `expense_reimbursements_enabled`: abilita o disabilita i rimborsi spese;
- `default_general_expenses_rate`: percentuale spese generali, oggi 10%;
- `default_cassa_rate`: percentuale cassa forense, oggi 4%.

Il vincolo `principals_economics_at_least_one_enabled` impedisce di disattivare
contemporaneamente compensi e rimborsi.

### `principal_clients`

Tabella ponte molti-a-molti fra committenti e clienti. Permette di usare
un'unica anagrafica cliente anche quando lo stesso cliente è collegato a più
committenti.

### `counterparties`

Controparti verso cui si svolge il recupero crediti o l'assistenza legale.
`kind` distingue:

- `individual`: persona fisica;
- `company`: società;
- `group`: controparte composta.

Per le persone fisiche bastano nome e cognome; per società e gruppi basta la
ragione sociale. Le note raccolgono informazioni aggiuntive non strutturate.

### `counterparty_subjects`

Soggetti interni a una controparte composta. Non hanno ruoli applicativi
obbligatori: servono solo a poter spuntare separatamente i componenti del gruppo
quando l'operatore deve lavorare su una controparte composta.

### `cases`

Le **pratiche** legali, chiamate anche posizioni. Nel recupero crediti la
pratica è l'incrocio fra committente (`principal_id`), cliente corrente
(`client_id`) e controparte (`counterparty_id`).

Contiene:

- numerazione interna storica (`case_number`, unica per utente);
- numero pratica numerico (`practice_number`, positivo e unico per utente);
- stato corrente (`status`)
- dati di causa (autorità, RG, controparte)
- accordo economico (`fee_type` flat/orario, `agreed_fee`, `hourly_rate`,
  `retainer`)
- date di apertura/chiusura

`case_number` resta per compatibilità con la UI attuale; il nuovo dominio usa
`practice_number`. Il trigger `cases_assign_practice_number` consente sia
l'inserimento manuale di un numero esistente, sia la generazione atomica del
prossimo numero libero.

### `case_credit_transfers`

Storico delle cessioni del credito. Registra quando una pratica passa da un
cliente precedente a un nuovo cliente. La pratica mostra sempre il cliente
corrente; la tabella mantiene il fatto storico della cessione.

### `case_status_history`

**Storico append-only** dei cambi di stato di una pratica. Popolata
automaticamente dal trigger `cases_log_status_change` su `INSERT` e su
`UPDATE` quando lo `status` cambia. Non si modifica né si elimina (RLS lo
impedisce). Ha indici su `case_id` e `user_id`, così le foreign key usate dal
trigger e dalle policy restano coperte anche al crescere dello storico.

### `price_books`

Prezzi annuali per committente. Ogni committente ha un set di prezzi per anno,
con stato `draft`, `active` o `archived` e flag separati per compensi e rimborsi.

Il vincolo `(user_id, principal_id, year)` garantisce un solo listino annuale
per committente e utente.

### `price_items`

Voci di prezzo del committente. `kind` distingue:

- `fee`: compenso/onorario a prezzo unitario;
- `expense_reimbursement`: rimborso spese Art. 15 con importo libero sulla
  singola attività.

Per i compensi `unit_price` è obbligatorio. `requires_hearing_dates` abilita la
raccolta del numero di udienze e della data di ciascuna udienza nei procedimenti
ordinari, mediazione, esecutivi e concorsuali.

### `case_activities`

Attività economiche della pratica: compensi e rimborsi spese da fatturare o già
fatturati al committente.

Ogni riga conserva uno snapshot della voce prezzo (`snapshot_price_year`,
`snapshot_price_code`, `snapshot_price_name`) per non cambiare lo storico quando
i prezzi annuali vengono aggiornati. Il totale viene calcolato dal trigger
`case_activities_set_amount` come `quantity * unit_price`.

Gli stati ammessi sono:

- `to_invoice`: da fatturare;
- `invoiced`: fatturata.

`invoice_id` viene valorizzato quando la voce viene fatturata tramite il modulo
Pratix. Resta facoltativo per consentire l'inserimento manuale di voci storiche
gia' fatturate prima dell'adozione del SaaS.

`postponed_until` e `postponed_count` supportano il rinvio al periodo di
fatturazione successivo.

### `case_activity_hearings`

Date udienza collegate a una riga attività quando la voce prezzo le richiede.
Servono per conteggiare udienze multiple senza perdere il dettaglio temporale.

### `activity_attachments`

Metadati degli allegati caricati su Supabase Storage per compensi e rimborsi:
nome originale, nome descrittivo, tipo documento, MIME type, dimensione, note e
flag anteprima.

### `invoices`

**Fatture / parcelle**. Contengono numerazione (`number` + `year`, unica per
utente), date, stato (`draft`, `issued`, `paid`, `overdue`), e tutti gli
importi calcolati: imponibile onorari, imponibile spese, anticipazioni
art.15, cassa, IVA, ritenuta, marca da bollo, totale, netto a pagare.

Il calcolo avviene lato applicazione (`src/lib/invoice-calc.ts`) e gli
importi vengono persistiti per evitare ricalcoli e per congelare il
documento al momento dell'emissione. Aliquote di default vengono ereditate
da `profiles` ma sono editabili per fattura.

Le fatture di recupero crediti vengono generate da attività incluse in una
sessione `billing_runs`: il soggetto fatturato è il committente
(`principal_id`), mentre `client_id` resta compilato come ancora tecnica
compatibile con lo schema storico. I campi `include_general_expenses`,
`general_expenses_rate`, `general_expenses_amount`, `cassa_base_amount`
congelano le spese generali opzionali. La cassa forense si calcola solo su
compensi + spese generali + eventuali spese imponibili legacy, non sui rimborsi
Art. 15.

### `billing_runs`

Sessioni di fatturazione per committente e periodo. Raccolgono le attività da
includere in fattura e congelano i totali del periodo:

- compensi;
- spese generali opzionali;
- base cassa;
- cassa forense;
- rimborsi spese Art. 15.

### `billing_run_items`

Righe selezionate in una sessione di fatturazione. `status` permette di
includere, rinviare o escludere una specifica attività dal periodo corrente.

### `billing_exports`

File Excel generati come rendiconto per il committente. `kind` distingue export
onorari/compensi ed export rimborsi spese. I file sono salvati in Supabase
Storage e collegati alla fattura tramite `invoice_id`.

### `invoice_lines`

**Righe di una fattura**. `kind` distingue:

- `fee`: onorario imponibile
- `expense_taxable`: spesa imponibile legacy, non generata dal nuovo flusso
  recupero crediti
- `expense_art15`: anticipazione fuori imponibile

`position` ordina le righe nel documento.
La tabella mantiene indici su `invoice_id` e `user_id`, così la cascata dalla
fattura e le policy RLS non richiedono scansioni complete.

La Fase 2 aggiunge campi snapshot di rendicontazione (`practice_number`,
`client_name`, `counterparty_name`, `activity_date`) e il collegamento opzionale
a `case_activities`.

### `imports`

Sessioni di import archivio, sia manuali guidate sia da Excel strutturato.
Tracciano stato, file sorgente quando presente, conteggi righe e note.

### `import_rows`

Righe di staging dell'import. Conservano dato grezzo (`raw_data`), dato
normalizzato (`normalized_data`), warning, errori e l'eventuale pratica creata o
agganciata.

La conferma operativa passa dalla funzione RPC `apply_import_row`, che legge una
riga `valid` o `warning` dell'utente autenticato e crea in una sola transazione
committente/cliente/controparte mancanti, relazione committente-cliente,
pratica, attività e udienze collegate.

Gli allegati caricati durante l'import guidato vengono salvati subito dopo la
conferma, usando gli ID attività pre-generati nello staging e i metadati in
`activity_attachments`.

## Relazioni (logiche, non FK)

```
profiles (1) ─── (N) user_table_preferences
       │
       └──── (N) principals ─── (N) price_books ─── (N) price_items
                      │
                      ├── (N) principal_clients ─── (N) clients
                      │
                      ├── (N) cases ─── (N) case_activities ─── (N) activity_attachments
                      │       │                    │
                      │       │                    └── (N) case_activity_hearings
                      │       ├── (N) case_status_history
                      │       └── (N) case_credit_transfers
                      │
                      └── (N) billing_runs ─── (N) billing_run_items
                                           └── (N) billing_exports

counterparties (1) ─── (N) counterparty_subjects
cases (N) ─── (1) counterparties
invoices (1) ─── (N) invoice_lines
imports (1) ─── (N) import_rows
```

## Storage

Pratix usa Supabase Storage con un bucket privato:

- `pratix-documents` — documenti, fatture generate, allegati, asset profilo ed
  export dell'utente.

I file sono organizzati con il primo segmento uguale all'UUID dell'utente:

```text
<user_id>/invoices/<invoice_id>/<file>
<user_id>/cases/<case_id>/<file>
<user_id>/activities/<activity_id>/<file>
<user_id>/billing-exports/<billing_run_id>/<file>
<user_id>/imports/<import_id>/<file>
<user_id>/profile/<file>
<user_id>/exports/<file>
```

Le policy su `storage.objects` concedono `select`, `insert`, `update` e
`delete` solo agli utenti autenticati quando `(storage.foldername(name))[1]`
coincide con `(select auth.uid())::text`. Il bucket resta privato: per mostrare
o scaricare file si usano client autenticati o URL firmati generati lato server
quando serve.

## Enum

| Enum                      | Valori                                                                           |
| ------------------------- | -------------------------------------------------------------------------------- |
| `billing_export_kind`     | fees, expenses                                                                   |
| `billing_run_item_status` | included, postponed, excluded                                                    |
| `billing_run_status`      | draft, finalized, cancelled                                                      |
| `case_activity_status`    | to_invoice, invoiced                                                             |
| `case_matter`             | civile, penale, lavoro, famiglia, amministrativo, tributario, commerciale, altro |
| `case_status`             | open, in_progress, suspended, closed, archived                                   |
| `client_kind`             | individual, company                                                              |
| `counterparty_kind`       | individual, company, group                                                       |
| `fee_type`                | flat, hourly                                                                     |
| `import_mode`             | manual, excel                                                                    |
| `import_row_status`       | pending, valid, warning, error, imported, skipped                                |
| `import_status`           | draft, validated, imported, cancelled                                            |
| `invoice_line_kind`       | fee, expense_taxable, expense_art15                                              |
| `invoice_status`          | draft, issued, paid, overdue                                                     |
| `price_book_status`       | draft, active, archived                                                          |
| `price_item_kind`         | fee, expense_reimbursement                                                       |
| `tax_regime`              | ordinario, forfettario                                                           |

Convenzione: i valori enum sono in **inglese minuscolo** (perché identifier
di codice), le label utente sono tradotte in italiano in `src/lib/labels.ts`.

## Trigger

| Tabella                             | Trigger                                      | Cosa fa                                                                        |
| ----------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------ |
| Tabelle user-owned con `updated_at` | `*_set_updated_at`                           | Aggiorna `updated_at = now()` su UPDATE                                        |
| `cases`                             | `cases_log_status_change`                    | Su INSERT e UPDATE (se status cambia), inserisce riga in `case_status_history` |
| `cases`                             | `cases_assign_practice_number`               | Genera o valida `practice_number` in modo atomico                              |
| `case_activities`                   | `case_activities_set_amount`                 | Calcola `amount = quantity * unit_price`                                       |
| `auth.users`                        | `on_auth_user_created` (gestito da Supabase) | Chiama `handle_new_user()` che crea la riga `profiles`                         |

Le funzioni usate solo dai trigger (`handle_new_user`, `log_case_status_change`
`set_updated_at`, `assign_case_practice_number` e `set_case_activity_amount`)
non sono eseguibili via RPC da ruoli `anon` o `authenticated`. La funzione
`get_next_practice_number` è invece eseguibile dagli utenti autenticati per
mostrare un numero suggerito in UI; l'inserimento resta comunque protetto dal
trigger.

## Cosa NON c'è (e perché)

- **Niente `time_entries`**: il time tracking è in roadmap (vedi `ROADMAP.md`,
  area "Funzionalità di prodotto" → ⬜). Per ora le ore si registrano nelle
  righe fattura.
- **Niente `case_deadlines`**: lo scadenzario autonomo è stato rimosso dal
  perimetro recupero crediti. Restano solo le date proprie dei documenti e
  della fatturazione, ad esempio la scadenza pagamento della fattura.
- **Niente tabella `documents` generica**: lo Storage privato è predisposto e
  gli allegati economici hanno `activity_attachments`, ma non c'è ancora un
  catalogo unico documentale per tutte le pratiche.
- **Niente tabella dedicata per export massivi**: lo ZIP PDF/XML delle fatture
  viene generato al download dai dati gia presenti in `invoices`,
  `invoice_lines` e dagli XML costruiti server-side.
- **Niente UI nuovo schema in Fase 2**: questa fase crea la base dati. Le
  schermate committenti, controparti, prezzi, attività, fatturazione e import
  arrivano nelle fasi successive.
- **Niente tabella `tags`**: per ora etichette libere in `notes` testuali.
  Se emergerà l'esigenza di filtri strutturati, valuteremo `text[]` o
  tabella separata.
- **Niente `audit_log` generico**: solo `case_status_history` per il dominio
  legale (cambio stato pratica = informazione che può servire in giudizio).
  Non logghiamo CRUD generici.

## Riferimenti

- [`../supabase/schema.sql`](../supabase/schema.sql) — verità SQL
- [`../supabase/migrations/`](../supabase/migrations/) — migrations dal 0.3.0 in poi
- [`./guides/database.md`](./guides/database.md) — guida operativa
- [`./glossario.md`](./glossario.md) — terminologia di prodotto
