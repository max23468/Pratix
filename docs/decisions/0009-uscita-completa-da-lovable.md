# ADR 0009 — Uscita completa da Lovable

- **Stato**: Accettato
- **Data**: 2026-05-01
- **Decisori**: proprietario Pratix, Codex

## Contesto

Pratix è nato su Lovable Cloud con backend Supabase gestito da Lovable e publish
integrato. Il progetto deve ora poter proseguire principalmente tramite Codex e
tool esterni, senza dipendere da Lovable per runtime, backend, publish, secrets
o gestione dati.

Il repository GitHub esiste già ed è il punto naturale da usare come fonte
primaria. Nel backend Lovable Cloud esiste al momento un solo utente, quindi la
migrazione dati/auth è ancora piccola abbastanza da essere gestita con rischio
contenuto.

## Decisione

Pratix uscira completamente da Lovable: GitHub diventa la fonte primaria del
codice, Codex l'ambiente principale di lavoro, il backend passa a un Supabase di
proprietà del progetto e la pubblicazione avviene fuori da Lovable tramite
Vercel, usando inizialmente un dominio gratuito `*.vercel.app`.

## Conseguenze

- ✅ Nessuna dipendenza operativa da Lovable dopo il cutover.
- ✅ Il codice, lo schema e la documentazione restano revisionabili in GitHub.
- ✅ Il backend diventa ispezionabile e amministrabile direttamente.
- ✅ Vercel elimina la necessità di gestire VPS, reverse proxy, TLS e deploy
  manuale.
- ✅ Supabase resta coerente con l'architettura già presente in Pratix: Postgres,
  Auth, RLS, client Supabase e types generati.
- ✅ Il dominio gratuito `*.vercel.app` copre il bisogno iniziale di un dominio
  senza acquistare subito un dominio proprietario.
- ⚠️ La migrazione auth va trattata con cautela; con un solo utente è preferibile
  creare l'utente nel nuovo Supabase preservando l'UUID, senza trasferire hash
  password dal vecchio ambiente.
- ⚠️ Le guide attuali che descrivono Lovable come runtime restano storiche fino
  al completamento del cutover e poi vanno aggiornate o archiviate.
- ⚠️ Dopo il cutover runtime, configurazione e documentazione operativa non
  devono contenere riferimenti a Lovable. I riferimenti storici eventualmente
  mantenuti devono essere censiti in `docs/migration/lovable-reference-audit.md`.

## Alternative considerate

- **Restare su Lovable Cloud** — semplice, ma non soddisfa l'obiettivo di
  chiudere Lovable al 100%.
- **Mantenere Lovable solo per publish** — riduce il lavoro immediato, ma lascia
  una dipendenza operativa.
- **Passare subito a Supabase self-hosted** — massima autonomia, ma introduce
  molto carico operativo su auth, storage, backup, update e sicurezza.
- **Deploy su VPS con DuckDNS** — utile se DuckDNS fosse un vincolo reale, ma
  aggiunge manutenzione non necessaria per Pratix in questa fase.
- **Deploy Cloudflare Workers** — coerente col runtime edge, ma Vercel è più
  lineare rispetto al bisogno attuale di uscire rapidamente da Lovable.

## Riferimenti

- [`../guides/uscita-lovable.md`](../guides/uscita-lovable.md)
- [`0002-lovable-cloud-supabase.md`](./0002-lovable-cloud-supabase.md)
