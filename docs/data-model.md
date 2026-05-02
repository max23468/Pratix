# Modello dati di Pratix

> Documento narrativo, leggibile senza accesso diretto al database. La sorgente di
> verità SQL è [`../supabase/schema.sql`](../supabase/schema.sql); questo file
> spiega **cosa** rappresentano le tabelle e **perché** sono fatte così.

Aggiornato a: versione **0.3.0**.

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
   utente referenziano `auth.users(id)`; pratiche, scadenze, spese, fatture e
   righe fattura dichiarano le relazioni fra loro per abilitare join PostgREST,
   cancellazioni coerenti e integrità referenziale.

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

### `clients`

Rubrica clienti dell'avvocato. `kind` distingue persona fisica (`individual`)
da soggetto giuridico (`company`); a seconda del tipo si valorizzano
`first_name`+`last_name` o `business_name`. Indirizzo e dati fiscali servono
per emettere fatture.

### `cases`

Le **pratiche** legali. Una pratica appartiene a un cliente (`client_id`)
e a un'unica materia (`matter`: civile, penale, lavoro…). Contiene:

- numerazione interna (`case_number`, unica per utente)
- stato corrente (`status`)
- dati di causa (autorità, RG, controparte)
- accordo economico (`fee_type` flat/orario, `agreed_fee`, `hourly_rate`,
  `retainer`)
- date di apertura/chiusura

### `case_deadlines`

**Scadenze** legate a una pratica. Una scadenza ha descrizione, data, e flag
`completed` con timestamp di completamento. Indice composito
`(user_id, due_date)` per query "prossime scadenze".

### `case_status_history`

**Storico append-only** dei cambi di stato di una pratica. Popolata
automaticamente dal trigger `cases_log_status_change` su `INSERT` e su
`UPDATE` quando lo `status` cambia. Non si modifica né si elimina (RLS lo
impedisce). Ha indici su `case_id` e `user_id`, così le foreign key usate dal
trigger e dalle policy restano coperte anche al crescere dello storico.

### `expenses`

**Spese** sostenute per conto del cliente. `is_art15` distingue le spese
escluse dall'imponibile ex art. 15 DPR 633/72 (anticipazioni in nome e per
conto del cliente) dalle spese imponibili. Una spesa può essere associata a
una fattura (`invoice_id` nullabile): finché è null, la spesa è "da
fatturare".

### `invoices`

**Fatture / parcelle**. Contengono numerazione (`number` + `year`, unica per
utente), date, stato (`draft`, `issued`, `paid`, `overdue`), e tutti gli
importi calcolati: imponibile onorari, imponibile spese, anticipazioni
art.15, cassa, IVA, ritenuta, marca da bollo, totale, netto a pagare.

Il calcolo avviene lato applicazione (`src/lib/invoice-calc.ts`) e gli
importi vengono persistiti per evitare ricalcoli e per congelare il
documento al momento dell'emissione. Aliquote di default vengono ereditate
da `profiles` ma sono editabili per fattura.

### `invoice_lines`

**Righe di una fattura**. `kind` distingue:

- `fee`: onorario imponibile
- `expense_taxable`: spesa imponibile
- `expense_art15`: anticipazione fuori imponibile

`position` ordina le righe nel documento.
La tabella mantiene indici su `invoice_id` e `user_id`, così la cascata dalla
fattura e le policy RLS non richiedono scansioni complete.

## Relazioni (logiche, non FK)

```
profiles (1) ─── (N) clients ─── (N) cases ─── (N) case_deadlines
                                     │              case_status_history
                                     └──── (N) expenses ─── (0..1) invoices ─── (N) invoice_lines
```

## Enum

| Enum                | Valori                                                                           |
| ------------------- | -------------------------------------------------------------------------------- |
| `case_matter`       | civile, penale, lavoro, famiglia, amministrativo, tributario, commerciale, altro |
| `case_status`       | open, in_progress, suspended, closed, archived                                   |
| `client_kind`       | individual, company                                                              |
| `expense_category`  | contributo_unificato, marche_da_bollo, copie, trasferte, ctu, notifiche, altro   |
| `fee_type`          | flat, hourly                                                                     |
| `invoice_line_kind` | fee, expense_taxable, expense_art15                                              |
| `invoice_status`    | draft, issued, paid, overdue                                                     |
| `tax_regime`        | ordinario, forfettario                                                           |

Convenzione: i valori enum sono in **inglese minuscolo** (perché identifier
di codice), le label utente sono tradotte in italiano in `src/lib/labels.ts`.

## Trigger

| Tabella                                                                  | Trigger                                      | Cosa fa                                                                        |
| ------------------------------------------------------------------------ | -------------------------------------------- | ------------------------------------------------------------------------------ |
| `profiles`, `clients`, `cases`, `case_deadlines`, `expenses`, `invoices` | `*_set_updated_at`                           | Aggiorna `updated_at = now()` su UPDATE                                        |
| `cases`                                                                  | `cases_log_status_change`                    | Su INSERT e UPDATE (se status cambia), inserisce riga in `case_status_history` |
| `auth.users`                                                             | `on_auth_user_created` (gestito da Supabase) | Chiama `handle_new_user()` che crea la riga `profiles`                         |

Le funzioni usate solo dai trigger (`handle_new_user`, `log_case_status_change`
e `set_updated_at`) non sono eseguibili via RPC da ruoli `anon` o
`authenticated`.

## Cosa NON c'è (e perché)

- **Niente `time_entries`**: il time tracking è in roadmap (vedi `ROADMAP.md`,
  area "Funzionalità di prodotto" → ⬜). Per ora le ore si registrano nelle
  righe fattura.
- **Niente `documents` / storage**: non gestiamo ancora allegati. Quando
  arriveranno, vivranno in Supabase Storage con bucket per-utente.
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
