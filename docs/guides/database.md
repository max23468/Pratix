# Guida — Database e sicurezza dati

Backend gestito dal progetto Supabase di proprietà di Pratix:
Postgres + Auth + Storage + Realtime.

## Principi non negoziabili

1. **RLS sempre attiva** su ogni tabella con dati utente.
2. **Foreign key verso `auth.users` solo quando utili all'integrità** — restano le policy RLS a decidere l'accesso.
3. **Mai memorizzare ruoli su `profiles`** — tabella `user_roles` separata + funzione `has_role()` `SECURITY DEFINER`.
4. **Mai modificare schemi riservati** Supabase: `auth`, `storage`, `realtime`, `supabase_functions`, `vault`.
5. **Validazioni con trigger**, non con `CHECK` immutabili (rompono il restore quando dipendono da `now()`).
6. **Mai hardcodare ruoli o admin lato client** (localStorage, ecc.) — sempre verifica server-side.

## Tabelle principali

(per il dettaglio aggiornato vedi `src/integrations/supabase/types.ts` — auto-generato)

- `profiles` — anagrafica del professionista (P.IVA, CF, indirizzo, regime fiscale, IBAN, ecc.)
- `user_roles` — ruoli applicativi (separati da `profiles`)
- `clients` — anagrafica clienti
- `cases` (Pratiche) — incarichi professionali
- `case_deadlines` (Scadenze) — adempimenti con data
- `expenses` (Spese) — spese sostenute per cliente
- `invoices` — fatture emesse, con righe e dati FatturaPA
- `invoice_lines` — righe fattura

Tutte le tabelle utente hanno `user_id uuid not null` e RLS che filtra per `user_id = (select auth.uid())`.

## Pattern RLS owner-scoped

```sql
-- Esempio: clienti visibili solo al proprietario
alter table public.clients enable row level security;

create policy "clients_owner_select"
  on public.clients for select
  using ((select auth.uid()) = user_id);

create policy "clients_owner_insert"
  on public.clients for insert
  with check ((select auth.uid()) = user_id);

create policy "clients_owner_update"
  on public.clients for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "clients_owner_delete"
  on public.clients for delete
  using ((select auth.uid()) = user_id);
```

## Pattern ruoli con `has_role()`

```sql
create type public.app_role as enum ('admin', 'user');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role app_role not null,
  unique (user_id, role)
);
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;
```

Le policy che richiedono ruolo usano poi `public.has_role((select auth.uid()), 'admin')`.

## Migrazioni

- Usa Supabase CLI e i file in `supabase/migrations/`.
- **Mai** `ALTER DATABASE postgres` nelle migrazioni: non è permesso.
- **Mai** modificare manualmente `src/integrations/supabase/types.ts`: è generato dall'API.
- Prima di applicare una migration remota, usa `npm run db:push:dry-run`.
- Dopo modifiche a schema, RLS, trigger o funzioni, usa:
  - `npm run db:advisors:security`
  - `npm run db:advisors:performance`
- Rigenera i tipi Supabase solo con `npm run db:types`, poi controlla il diff.

Non automatizzare `supabase db push` da GitHub Actions finché Pratix usa un solo
progetto Supabase. Il deploy del database resta manuale e intenzionale: il
workflow CI deve verificare, non cambiare la produzione.

## Supabase Auth

Impostazioni operative desiderate nel dashboard Supabase:

- Registrazione aperta: `Allow new users to sign up` attivo.
- Conferma email attiva per le nuove registrazioni.
- Secure Email Change non attivo per scelta di prodotto attuale.
- Policy password standard: minimo applicativo 8 caratteri; non rafforzare i
  requisiti Supabase finché il percorso resta volutamente leggero.
- Anonymous sign-ins disattivati.
- Rate limits Auth rivisti e lasciati su valori prudenti per il piano gratuito.
- Redirect URL produzione:
  - `https://pratix.vercel.app/dashboard`
  - `https://pratix.vercel.app/reimposta-password`

La UI gestisce sia registrazione con sessione immediata sia registrazione con
email da confermare. Il cambio password in-app richiede già la password attuale
prima di chiamare Supabase.

### CAPTCHA

Supabase Auth supporta CAPTCHA su registrazione, login e recupero password.
Pratix è predisposto per Cloudflare Turnstile:

1. Crea il widget Turnstile per `pratix.vercel.app` e per gli eventuali domini preview.
2. Inserisci la secret key in Supabase Auth → Bot and Abuse Protection.
3. Aggiungi `VITE_TURNSTILE_SITE_KEY` in Vercel Production e Preview.
4. Ridistribuisci: i form pubblici mostreranno la verifica solo quando la site key è presente.

Non salvare la secret key Turnstile in GitHub o nei file `.env` tracciati.

### Email Auth

Per produzione conviene configurare Custom SMTP in Supabase, così conferme e
recuperi password non dipendono dal servizio email di default.

Template italiani consigliati:

- Confirm signup: oggetto `Conferma il tuo account Pratix`; testo breve con
  link di conferma e nota "Se non hai richiesto tu la registrazione, ignora
  questa email."
- Reset password: oggetto `Reimposta la password di Pratix`; testo breve con
  link valido per il tempo impostato in Supabase.
- Change email: mantenere testo neutro e conferma sul nuovo indirizzo quando la
  funzione verrà attivata.

Non inserire dati personali, importi o riferimenti a clienti nei template Auth.

## Realtime

Per attivare realtime su una tabella:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
```

Lato client:

```ts
import { supabase } from "@/integrations/supabase/client";

const channel = supabase
  .channel("messages")
  .on("postgres_changes", { event: "*", schema: "public" }, (payload) => {
    console.log(payload);
  })
  .subscribe();
```

Le policy RLS continuano a valere anche sui messaggi realtime.

## Limiti utili da ricordare

- Default **1000 righe** per query Supabase: se "mancano dati", verifica il limit prima di cercare bug.
- Ogni modifica strutturale passa da migration versionata: non eseguirla solo in console.

## Linter e scan

- `supabase db advisors --linked --type security` per anomalie di sicurezza.
- `supabase db advisors --linked --type performance` per anomalie di performance.
- Linter pulito **non** garantisce sicurezza: review manuale delle policy obbligatoria.

## Backup gratuito

Il piano gratuito non deve dipendere da Point-in-Time Recovery o Log Drains. Per
Pratix il backup operativo è manuale:

1. Esporta periodicamente un dump logico del database con strumenti Supabase CLI
   o Postgres.
2. Conserva il dump fuori dal repository GitHub.
3. Non salvare mai nel repo dump reali, dati clienti, fatture, email o chiavi.
4. Quando possibile, prova il restore su ambiente locale o su un progetto
   temporaneo non produttivo.

Le migrations e `supabase/schema.sql` restano in GitHub; i dati reali no.
