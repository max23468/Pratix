# Guida — Database e sicurezza dati

Backend gestito da Lovable Cloud (Supabase). Postgres + Auth + Storage + Realtime.

## Principi non negoziabili

1. **RLS sempre attiva** su ogni tabella con dati utente.
2. **Mai chiave esterna verso `auth.users`** — usare `user_id uuid` libero e referenziarlo nelle policy.
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
- `deadlines` (Scadenze) — adempimenti con data
- `expenses` (Spese) — costi sostenuti per cliente
- `invoices` — fatture emesse, con righe e dati FatturaPA

Tutte le tabelle utente hanno `user_id uuid not null` e RLS che filtra per `user_id = auth.uid()`.

## Pattern RLS owner-scoped

```sql
-- Esempio: clienti visibili solo al proprietario
alter table public.clients enable row level security;

create policy "clients_owner_select"
  on public.clients for select
  using (auth.uid() = user_id);

create policy "clients_owner_insert"
  on public.clients for insert
  with check (auth.uid() = user_id);

create policy "clients_owner_update"
  on public.clients for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "clients_owner_delete"
  on public.clients for delete
  using (auth.uid() = user_id);
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

Le policy che richiedono ruolo usano poi `public.has_role(auth.uid(), 'admin')`.

## Migrazioni

- Usa lo strumento di migrazione di Lovable Cloud (richiede approvazione utente).
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
- Ogni operazione in scrittura passa dalle migration tool: non eseguirle a mano in console.

## Linter e scan

- `supabase--linter` programmatico per anomalie (RLS mancante, policy permissive).
- `security--run_security_scan` per scan complessivi.
- Linter pulito **non** garantisce sicurezza: review manuale delle policy obbligatoria.
