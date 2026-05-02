# Migrations Supabase — guida operativa

Questa guida spiega come Pratix tiene traccia delle migrations del database nel
progetto Supabase di proprietà.

## Stato attuale

- **Baseline schema**: [`../../supabase/schema.sql`](../../supabase/schema.sql)
  è la fotografia leggibile dello stato del DB. Va aggiornata quando cambia lo
  schema.
- **Migrations versionate**: vivono in [`../../supabase/migrations/`](../../supabase/migrations/)
  e si applicano in ordine cronologico.
- **Registro remoto**: Supabase mantiene lo storico in
  `supabase_migrations.schema_migrations`.

## Quando applichiamo una migration

1. Crea il file con `supabase migration new <nome_descrittivo>`.
2. Scrivi SQL idempotente quando possibile e limitato allo scopo.
3. Verifica con `supabase db push --dry-run`.
4. Applica al progetto collegato con `supabase db push --yes`.
5. Verifica con `supabase migration list`.
6. Se cambia il modello dati, aggiorna:
   - [`../../supabase/schema.sql`](../../supabase/schema.sql)
   - [`../data-model.md`](../data-model.md)
   - [`../../CHANGELOG.md`](../../CHANGELOG.md), se rilevante

## Cosa NON committiamo mai

- **Dati delle tabelle**: clienti, fatture, profili o export con PII.
- **Secret e service-role key**: vivono in Vercel/Supabase, mai in repo.
- **Dump completi non sanitizzati**: usare file locali ignorati da git.

## Schemi riservati

Non modificare manualmente oggetti dei domini riservati Supabase (`auth`,
`storage`, `realtime`, `vault`) salvo casi documentati e necessari, come il
trigger `on_auth_user_created` su `auth.users`.

## Riproducibilità del DB da zero

Per ricreare il DB:

1. applica le migrations in `supabase/migrations/`;
2. usa `supabase/schema.sql` come baseline leggibile e controllo manuale;
3. importa i dati solo da export locali non committati.

## Riferimenti

- [`../data-model.md`](../data-model.md) — modello dati narrativo
- [`./database.md`](./database.md) — guida generale al database
