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
  .on("postgres_changes", { event: "*", schema: "public" }, payload => {
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
