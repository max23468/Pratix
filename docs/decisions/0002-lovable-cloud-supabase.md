# ADR 0002 — Backend: Lovable Cloud (Supabase)

- **Stato**: Sostituito come target da ADR 0009
- **Data**: 2026-04-29

## Contesto

Pratix gestisce dati personali e fiscali sensibili: anagrafica avvocati, anagrafica clienti, fatture, scadenze. Servono:

- database relazionale (Postgres) con vincoli e migrazioni versionate,
- autenticazione email/password,
- Row-Level Security per isolamento dati per utente,
- storage allegati,
- edge functions per logica server-side,
- nessun setup manuale di account terzi all'avvio.

Lovable Cloud fornisce tutto questo nativamente, basato su Supabase, con `client.ts` e `types.ts` auto-generati.

## Decisione storica

Abbiamo adottato **Lovable Cloud (Supabase)** come backend unico iniziale per Pratix:

- Postgres con RLS obbligatoria su tutte le tabelle utente,
- Auth Supabase,
- Storage per allegati,
- Edge Functions per integrazioni e webhook,
- Secrets di Lovable Cloud per chiavi sensibili.

Comunichiamo agli utenti finali come **"Lovable Cloud"** (mai "Supabase" nei testi visibili).

## Conseguenze

- ✅ Setup zero, nessuna gestione di account esterni.
- ✅ `client.ts` e `types.ts` sempre allineati allo schema.
- ✅ RLS riduce drasticamente il rischio di leak dati cross-utente.
- ✅ Migration tool integrato con approvazione esplicita.
- ⚠️ **Mai** modificare a mano `src/integrations/supabase/client.ts`, `src/integrations/supabase/types.ts`, `.env`.
- ⚠️ **Mai** modificare schemi riservati (`auth`, `storage`, `realtime`, `supabase_functions`, `vault`).
- ⚠️ Dipendenza forte dal vendor; in futuro un'eventuale migrazione richiederebbe lavoro non banale.

## Alternative considerate

- **Backend custom Node + Postgres** — flessibile, ma 10x più tempo di setup e mantenimento.
- **Firebase** — auth e storage maturi, ma niente Postgres, RLS e tipizzazione dei dati relazionali peggiore per il dominio.
- **PocketBase / NocoBase self-hosted** — promettenti, ma operativamente onerosi e fuori dal template Lovable.

## Riferimenti

- [`docs/guides/database.md`](../guides/database.md)
- [`0009-uscita-completa-da-lovable.md`](./0009-uscita-completa-da-lovable.md)
- [`SECURITY.md`](../../SECURITY.md)
