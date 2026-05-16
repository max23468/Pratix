# Inventario Lovable sanitizzato

Documento tecnico derivato dalle risposte Lovable per la migrazione fuori da
Lovable. Non contiene email, indirizzi, UUID utente completi, export dati,
password, recovery link, service role key o connection string.

## Target migrazione

- Codice: GitHub.
- Hosting: Vercel, con dominio iniziale `*.vercel.app`.
- Backend: nuovo progetto Supabase di proprietà.
- Sviluppo e manutenzione: Codex.
- Lovable: ambiente storico da disconnettere dopo cutover riuscito.

## Backend attuale

- Backend attuale: Lovable Cloud managed, basato su Supabase gestito da Lovable.
- Regione: EU.
- Utenti auth: 1.
- Storage buckets: nessuno.
- Edge Functions: nessuna.
- Webhook, cron, API pubbliche: nessuno rilevato.
- Server functions nel repo: `src/server/invoices.functions.ts`.

## Schema public

Tabelle:

- `profiles`
- `clients`
- `cases`
- `case_deadlines`
- `case_status_history`
- `expenses`
- `invoices`
- `invoice_lines`

Viste: nessuna.

Enum:

- `case_matter`
- `case_status`
- `client_kind`
- `expense_category`
- `fee_type`
- `invoice_line_kind`
- `invoice_status`
- `tax_regime`

Funzioni SQL:

- `handle_new_user()`
- `log_case_status_change()`
- `set_updated_at()`

RLS:

- Attiva su tutte le tabelle user-owned.
- Policy owner-scoped basate su `auth.uid() = user_id`.
- `profiles` usa `id = auth.uid()`.
- `case_status_history` espone solo select/insert.

## Migrations e baseline

- Migrations registrate: 3.
- Cartella `supabase/migrations/`: completa e allineata al registro.
- `supabase/schema.sql`: baseline sufficiente per ricreare lo schema, aggiornata
  per includere anche il trigger `on_auth_user_created` su `auth.users`.

Verifica trigger dopo l'apply sul nuovo Supabase:

```sql
SELECT tgname, tgrelid::regclass, tgenabled
FROM pg_trigger
WHERE tgname = 'on_auth_user_created';
```

## Dati esistenti

- `profiles`: 1 riga.
- Tutte le altre tabelle applicative: 0 righe.

L'export raw del profilo contiene dati personali e deve restare fuori da git.
Usare solo artefatti locali temporanei ignorati da `.gitignore`.

## Strategia auth

Lovable conferma che la creazione utente nel nuovo Supabase può preservare
l'UUID via Admin API con service role key.

Procedura:

1. Applicare schema e trigger nel nuovo Supabase.
2. Creare l'utente auth con UUID preservato tramite script locale.
3. Lasciare che `on_auth_user_created` crei una riga minimale in `profiles`.
4. Aggiornare quella riga con i dati esportati.
5. Impostare una password temporanea locale e verificarne il login.
6. Cambiare la password temporanea dall'area Account appena l'app punta al nuovo
   Supabase. Completato in locale il 2026-05-02.

Lo script locale usato per questa operazione è stato rimosso dopo il cutover.
Pratix usa link email passwordless e non conserva più helper per creare utenti
con password temporanea.

## Variabili ambiente target

Su Vercel:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` solo server-side

Da non migrare:

- `LOVABLE_API_KEY`, perché non risulta usata nel codice runtime.

## Cleanup prima del cutover

- Rimuovere `@lovable.dev/vite-tanstack-config`.
- Sostituire `vite.config.ts` con configurazione esplicita Vercel/TanStack.
- Rimuovere `wrangler.jsonc` se il target resta Vercel.
- Valutare rimozione `bunfig.toml` e `bun.lockb` se si passa a npm puro.
- Rimuovere riferimenti Lovable da codice e documentazione corrente.

Gate finale:

```bash
rg -i "lovable|@lovable\\.dev" .
```

Nel working tree post-migrazione deve restituire zero risultati, salvo decisione
esplicita di mantenere documenti storici temporanei.
