# Guida — Database e sicurezza dati

Backend gestito dal progetto Supabase di proprietà di Pratix:
Postgres + Auth + Storage + Realtime.

## Principi non negoziabili

1. **RLS sempre attiva** su ogni tabella con dati utente.
2. **Foreign key verso `auth.users` solo quando utili all'integrità** — restano le policy RLS a decidere l'accesso.
3. **Mai memorizzare ruoli su `profiles`** — tabella `user_roles` separata + funzione `has_role()` `SECURITY DEFINER`.
4. **Mai modificare schemi riservati** Supabase: `auth`, `storage`, `realtime`, `supabase_functions`, `vault`, salvo policy Storage documentate e versionate in migration.
5. **Validazioni con trigger**, non con `CHECK` immutabili (rompono il restore quando dipendono da `now()`).
6. **Mai hardcodare ruoli o admin lato client** (localStorage, ecc.) — sempre verifica server-side.

## Tabelle principali

(per il dettaglio aggiornato vedi `src/integrations/supabase/types.ts` — auto-generato)

- `profiles` — anagrafica del professionista (P.IVA, CF, indirizzo, regime fiscale, IBAN, ecc.)
- `user_roles` — ruoli applicativi (separati da `profiles`)
- `clients` — anagrafica clienti
- `principals` — committenti, cioè soggetti a cui viene emessa fattura
- `principal_clients` — relazione molti-a-molti fra committenti e clienti
- `counterparties` — controparti del recupero crediti
- `counterparty_subjects` — soggetti interni a una controparte composta
- `cases` (Pratiche) — posizioni legali, con numero pratica numerico univoco
- `case_credit_transfers` — storico cessioni credito fra clienti
- `price_books` — prezzi annuali per committente
- `price_items` — voci di prezzo per compensi/onorari e rimborsi spese
- `case_activities` — attività economiche da fatturare o fatturate
- `case_activity_hearings` — date udienza collegate alle attività che le richiedono
- `activity_attachments` — metadati allegati su compensi e rimborsi
- `billing_runs` — selezioni fatturazione per committente e periodo
- `billing_run_items` — righe incluse, rinviate o escluse da una fatturazione
- `billing_exports` — rendiconti Excel generati
- `imports` — sessioni import manuale o Excel
- `import_rows` — righe di staging import
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
- Per eseguire tutti i controlli Supabase collegati, preferisci
  `npm run db:verify`: lancia dry-run e advisor in sequenza, evitando più
  connessioni simultanee al pooler.
- Dopo modifiche a bucket o policy Storage, usa almeno:
  - `npm run db:push:dry-run`
  - `npm run db:advisors:security`
- Rigenera i tipi Supabase solo con `npm run db:types`, poi controlla il diff.

Non automatizzare `supabase db push` da GitHub Actions finché Pratix usa un solo
progetto Supabase. Il deploy del database resta manuale e intenzionale: il
workflow CI deve verificare, non cambiare la produzione.

## Supabase Auth

Impostazioni operative desiderate nel dashboard Supabase:

- Registrazione aperta: `Allow new users to sign up` attivo.
- Conferma email attiva per le nuove registrazioni.
- Secure Email Change non attivo per scelta di prodotto attuale.
- Leaked Password Protection: attivare se il progetto Supabase passa a un piano
  Pro o superiore; sul piano gratuito l'advisor security può continuare a
  segnalarla anche se la UI non usa password.
- Policy password: non centrale nel percorso corrente, perché login e
  registrazione usano magic link via email.
- Passkey: abilitate lato client come feature sperimentale Supabase; mantenere
  magic link come fallback operativo.
- Anonymous sign-ins disattivati.
- Rate limits Auth rivisti e lasciati su valori prudenti per il piano gratuito.
- Site URL produzione: `https://pratix.vercel.app/`.
- Redirect URL produzione:
  - `https://pratix.vercel.app/dashboard`
  - `https://pratix.vercel.app/reimposta-password`
- Template email Supabase personalizzati in italiano per conferma account, magic
  link e cambio email, con link `{{ .ConfirmationURL }}`.

La UI usa `signInWithOtp` sia per login sia per registrazione. La registrazione
passa `full_name` nei metadata Supabase, così il trigger profilo conserva il nome
del professionista quando l'utente viene creato.

Il template Magic Link è tracciato anche in `supabase/config.toml` e
`supabase/templates/magic_link.html`; la configurazione remota va aggiornata con
`supabase config push` solo dopo aver controllato il diff prodotto dal CLI.

### Stato corrente Auth

Al 2026-05-16 il percorso free-tier scelto è:

- registrazione aperta;
- magic link via email come metodo principale;
- passkey come accesso rapido sperimentale parcheggiato dietro
  `VITE_ENABLE_PASSKEYS=true`: al 2026-05-16 il progetto hosted risponde
  `Passkey configuration is not currently available` al tentativo di abilitare
  `auth.passkey`/`auth.webauthn` via `supabase config push`;
- `/recupera-password` e `/reimposta-password` restano come pagine informative
  no-password per vecchi link o bookmark;
- MFA non implementata per scelta attuale;
- Secure Email Change non attivo per scelta attuale;
- Leaked Password Protection lasciata fuori perché richiede un piano a pagamento
  e perché la UI non espone più password.
- Bonifica password residue: al 2026-05-16 il progetto Supabase contiene ancora
  hash password per gli utenti creati prima del passaggio passwordless. Supabase
  non espone nel `config.toml` un toggle separato per disabilitare
  `signInWithPassword` mantenendo attivi magic link e provider email; non
  modificare direttamente `auth.users.encrypted_password` senza decisione
  esplicita, perché è una bonifica irreversibile e di basso livello.

Se un test di registrazione reale incontra `over_email_send_rate_limit`, non
alzare subito i limiti: attendi il reset della finestra Supabase e riprova con
una casella controllata. Evita tentativi ripetuti con indirizzi fittizi, perché
possono consumare il limite email.

### CAPTCHA

Supabase Auth supporta CAPTCHA su registrazione e login.
Pratix è predisposto per Cloudflare Turnstile, ma l'integrazione non è attiva
nel percorso corrente: non creare widget Cloudflare e non configurare secret
Turnstile finché non viene presa una nuova decisione.

Se in futuro si decide di attivarla:

1. Crea il widget Turnstile per `pratix.vercel.app` e per gli eventuali domini preview.
2. Inserisci la secret key in Supabase Auth → Bot and Abuse Protection.
3. Aggiungi `VITE_TURNSTILE_SITE_KEY` in Vercel Production e Preview.
4. Ridistribuisci: i form pubblici mostreranno la verifica solo quando la site key è presente.

Non salvare la secret key Turnstile in GitHub o nei file `.env` tracciati.

### Email Auth

Il template Supabase Magic Link è personalizzato in italiano. Conferma account e
cambio email devono restare allineati alla stessa linea editoriale quando
vengono toccati. Custom SMTP e dominio email dedicato restano opzionali: non
sono un blocco operativo nel percorso gratuito attuale.

Template italiani attesi:

- Confirm signup: oggetto `Conferma il tuo account Pratix`; testo breve con
  link di conferma e nota "Se non hai richiesto tu la registrazione, ignora
  questa email."
- Magic Link: oggetto `Accedi a Pratix`; testo breve con link monouso e nota
  "Se non hai richiesto tu l'accesso, ignora questa email."
- Change email: testo neutro con conferma del nuovo indirizzo, se la funzione è
  attiva nel dashboard Supabase.

Non inserire dati personali, importi o riferimenti a clienti nei template Auth.

## Supabase Storage

Pratix usa un solo bucket privato:

- `pratix-documents`

Il bucket ospita documenti, fatture, allegati delle attività, asset profilo ed
export. I file devono sempre stare sotto una cartella proprietario con UUID
utente come primo segmento:

```text
<user_id>/invoices/<invoice_id>/<file>
<user_id>/cases/<case_id>/<file>
<user_id>/activities/<activity_id>/<file>
<user_id>/billing-exports/<billing_run_id>/<file>
<user_id>/imports/<import_id>/<file>
<user_id>/profile/<file>
<user_id>/exports/<file>
```

Le costanti e i builder path vivono in `src/lib/storage-paths.ts`. Non costruire
path Storage a mano dentro componenti o server functions, così resta più facile
mantenere le policy allineate.

Il bucket è privato, con limite file a 25 MB e MIME types comuni per PDF, XML,
ZIP, CSV, Excel, OpenDocument, testo, immagini e documenti office. Se serve un
formato nuovo, aggiungi prima il MIME type nella migration Storage e poi
aggiorna questa guida.

Le policy su `storage.objects` sono owner-scoped:

- `select` solo se il primo segmento del path è `(select auth.uid())::text`;
- `insert` solo dentro la cartella dell'utente autenticato;
- `update` con `using` e `with check` sulla stessa cartella;
- `delete` solo dentro la cartella dell'utente.

Per upload con upsert servono `select`, `insert` e `update`: non rimuovere una
di queste policy pensando che basti `insert`.

Non rendere pubblico il bucket. Per condivisioni temporanee usa URL firmati
generati lato server, senza inserire nomi clienti, importi o dati personali nei
log.

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

Per Storage, gli advisors vanno accompagnati da un controllo manuale delle
policy su `storage.objects`: bucket privato, path owner-scoped, nessuna policy
`to public` e nessuna condizione basata su metadata modificabili dall'utente.

### Residui advisor noti

- **Security — `Leaked Password Protection Disabled`**: warning accettato nel
  percorso gratuito corrente. La protezione richiede un piano Supabase a
  pagamento; la UI non espone password, ma l'advisor può restare visibile sul
  piano Free.
- **Performance — foreign key senza indice**: gli avvisi su
  `case_status_history.user_id` e `invoice_lines.user_id` sono stati chiusi con
  la migration `20260502173000_add_fk_supporting_indexes.sql`.
- **Performance — indici unused**: gli indici segnalati come non usati su
  `cases`, `invoices` e `invoice_lines` non vanno rimossi alla cieca.
  Rivalutarli solo dopo traffico reale, query osservate e conferma che non
  servano a filtri, join, ordinamenti o policy RLS.

## Backup gratuito

Il piano gratuito non deve dipendere da Point-in-Time Recovery o Log Drains. Per
Pratix il backup operativo è manuale:

1. Esporta periodicamente un dump logico del database con strumenti Supabase CLI
   o Postgres.
2. Conserva il dump fuori dal repository GitHub.
3. Non salvare mai nel repo dump reali, dati clienti, fatture, email o chiavi.
4. Quando possibile, prova il restore su ambiente locale o su un progetto
   temporaneo non produttivo.
5. Per Storage, esporta periodicamente anche gli oggetti del bucket
   `pratix-documents` con strumenti Supabase/S3 compatibili, sempre fuori dal
   repository e preferibilmente in archivio cifrato.

Le migrations e `supabase/schema.sql` restano in GitHub; i dati reali no.
Se un export serve durante una migrazione, mettilo in una cartella ignorata o
fuori dal checkout e cancellalo appena il restore e la verifica sono conclusi.
