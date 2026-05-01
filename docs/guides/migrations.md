# Migrations Supabase — guida operativa

Questa guida spiega come Pratix tiene traccia delle migrations del database
quando lavoriamo via Lovable Cloud. Il target aggiornato è spostare il backend
su Supabase di proprietà del progetto: vedi
[`uscita-lovable.md`](./uscita-lovable.md).

## Stato attuale

- **Baseline schema**: [`../../supabase/schema.sql`](../../supabase/schema.sql) è
  la fotografia leggibile dello stato del DB alla versione **0.3.0**. Lo
  aggiorniamo a mano dopo ogni migration applicata.
- **Migrations applicate**: vivono nel registro interno Supabase
  (`supabase_migrations.schema_migrations`). Non sono state esportate
  retroattivamente file-per-file nel repo perché il flusso Lovable le
  applica direttamente; per lo stato cumulativo basta `schema.sql`.
- **Migrations future**: la cartella `supabase/migrations/` è gestita dal
  tool Lovable Cloud. Quando applichiamo una migration via chat, il tool
  scrive il file lì in automatico.

## Quando applichiamo una migration

1. La proponi in chat (è il flusso normale Lovable Cloud).
2. La approvi tu come proprietario.
3. Il tool la esegue contro il DB e la archivia in `supabase/migrations/`.
4. **Io aggiorno [`schema.sql`](../../supabase/schema.sql)** per tenere
   allineata la baseline leggibile.
5. Se cambia il modello dati visibile, aggiorno
   [`../data-model.md`](../data-model.md).
6. Se cambia un comportamento utente, aggiungo voce in
   [`../../CHANGELOG.md`](../../CHANGELOG.md) sotto `[Non rilasciato]`.

## Cosa NON committiamo mai

- **Dati delle tabelle** (clienti, fatture, profili): sono PII, mai in git.
  Per backup esistono gli export CSV da Cloud → Database → Tables.
- **Oggetti dei domini riservati Supabase**: `auth`, `storage`, `realtime`,
  `vault`, `supabase_functions`. Non li tocchiamo manualmente.
- **Secret e service-role key**: vivono in Lovable Cloud, mai in repo.

## Riproducibilità del DB da zero

Per ricreare lo stato attuale in un nuovo progetto Supabase basta eseguire
[`../../supabase/schema.sql`](../../supabase/schema.sql). Le migrations
successive (`supabase/migrations/*.sql`) si eseguono in ordine cronologico.

Non automatizziamo questo flusso: Pratix è un singolo progetto Lovable
Cloud, non una libreria multi-tenant.

## Riferimenti

- [`../data-model.md`](../data-model.md) — modello dati narrativo
- [`./database.md`](./database.md) — guida generale al database
- [`../decisions/0002-lovable-cloud-supabase.md`](../decisions/0002-lovable-cloud-supabase.md)
