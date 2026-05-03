# ADR 0012 — Storage privato e observability Vercel-first

- **Stato**: Accettato
- **Data**: 2026-05-03
- **Decisori**: Matteo / Codex

## Contesto

Pratix deve iniziare a integrare la gestione file e rafforzare il monitoraggio
di produzione senza allargare lo stack oltre il necessario. Le priorita decise
sono:

- restare su Vercel per osservabilita, performance e log;
- non introdurre Sentry finche la diagnostica Vercel basta;
- usare Supabase Storage per documenti, fatture e futuri allegati;
- evitare servizi email transazionali e pagamenti in questa fase;
- mantenere il percorso gratuito e semplice, con strumenti Supabase gia
  disponibili per advisor, dry-run e backup operativo.

## Decisione

Pratix adotta una baseline Vercel-first per osservabilita e un bucket Supabase
Storage privato unico, `pratix-documents`, con path owner-scoped
`<user_id>/<area>/...`.

Le aree Storage standard sono:

- `invoices`;
- `cases`;
- `expenses`;
- `profile`;
- `exports`.

Le policy su `storage.objects` concedono lettura, inserimento, aggiornamento ed
eliminazione solo agli utenti autenticati quando il primo segmento del path
coincide con l'UUID dell'utente.

## Conseguenze

- La gestione file resta dentro Supabase, coerente con Postgres, Auth e RLS.
- Non servono nuovi provider per monitoraggio o storage nella fase corrente.
- I file restano privati per default; eventuali download pubblici devono passare
  da URL firmati o da codice server.
- Gli upload futuri devono usare i path builder in `src/lib/storage-paths.ts`
  invece di costruire path a mano.
- Gli advisor Supabase restano parte del controllo, ma le policy Storage
  richiedono anche review manuale.
- Se in futuro Vercel Observability non basta per error tracking applicativo,
  Sentry potra essere rivalutato con un ADR dedicato.

## Alternative considerate

- **Sentry subito** — Scartato per ora: aggiunge provider, configurazione e
  privacy review prima che ci sia un bisogno operativo provato.
- **Bucket separati per ogni dominio** — Scartato: moltiplica policy e
  gestione senza vantaggio immediato. Le aree nel path sono sufficienti.
- **Storage pubblico** — Scartato: documenti, fatture e allegati possono
  contenere dati personali o fiscali.
- **Provider storage esterno** — Scartato: Supabase Storage e gia coerente con
  l'architettura scelta.

## Riferimenti

- [`../guides/database.md`](../guides/database.md)
- [`../guides/deploy.md`](../guides/deploy.md)
- [`../../supabase/migrations/20260503103536_add_private_storage_bucket.sql`](../../supabase/migrations/20260503103536_add_private_storage_bucket.sql)
- [`../../src/lib/storage-paths.ts`](../../src/lib/storage-paths.ts)
