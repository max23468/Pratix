# Pratix

> **Tutto torna.**
>
> Gestionale per avvocati freelance: pratiche, clienti, scadenze, spese, fatture (FatturaPA inclusa).

[![Stack](https://img.shields.io/badge/stack-TanStack%20Start-3B82F6)](#) [![Backend](https://img.shields.io/badge/backend-migrazione%20Supabase-orange)](#) [![Lingua](https://img.shields.io/badge/lingua-italiano-green)](#)

---

## Cos'è Pratix

Pratix è il gestionale pensato per **avvocati freelance italiani**: nessun fronzolo, nessuna logica da grande studio associato. Solo gli strumenti che servono al singolo professionista per tenere in ordine pratiche, clienti, scadenze, spese e fatture, con piena conformità FatturaPA.

Il target esplicito è il **professionista singolo**: il prodotto evita il linguaggio degli studi associati (vedi [glossario](docs/glossario.md) e [tono di voce](docs/guides/tono-di-voce.md)).

## Avvio rapido

```bash
npm ci          # installa dipendenze
npm run dev     # avvia in locale
npm run build   # build di produzione
npm run lint    # linter
```

Le variabili d'ambiente (`.env`) non vanno committate. Durante la migrazione da Lovable alcune variabili sono ancora gestite da Lovable Cloud; il target è spostarle su Supabase/host controllati. Non modificare manualmente `.env`, `src/integrations/supabase/client.ts`, `src/integrations/supabase/types.ts`, `src/routeTree.gen.ts`.

## Mappa della documentazione

| File | Cosa contiene |
|---|---|
| [`README.md`](./README.md) | Questo file: panoramica e indice |
| [`AGENTS.md`](./AGENTS.md) | Regole operative per chi (umani o agenti) modifica il codice |
| [`BRAND.md`](./BRAND.md) | Guidelines di marca complete |
| [`ROADMAP.md`](./ROADMAP.md) | Stato del prodotto per area, con legenda ✅🟡⬜💤 |
| [`CHANGELOG.md`](./CHANGELOG.md) | Storia delle modifiche significative |
| [`SECURITY.md`](./SECURITY.md) | Come segnalare vulnerabilità |
| [`CONTRIBUTING.md`](./CONTRIBUTING.md) | Come contribuire al progetto |
| [`LICENSE`](./LICENSE) | Licenza d'uso |
| [`docs/`](./docs/) | Guide tematiche, memoria di progetto, decision log, glossario |

## Migrazione fuori da Lovable

Pratix sta passando a una filiera senza dipendenze operative da Lovable: GitHub
come fonte primaria, Codex come ambiente principale, backend Supabase di
proprietà del progetto e pubblicazione fuori da Lovable tramite Vercel.

Piano operativo: [`docs/guides/uscita-lovable.md`](./docs/guides/uscita-lovable.md).
Decisione architetturale: [`docs/decisions/0009-uscita-completa-da-lovable.md`](./docs/decisions/0009-uscita-completa-da-lovable.md).

## Documentazione approfondita

- 📖 [Guide tematiche](./docs/guides/) — architettura, database, fatturazione, tema, tono di voce, deploy
- 🧠 [Memoria di progetto](./docs/memory/) — regole sempre attive (specchio leggibile di `mem://`)
- 🧭 [Decision log (ADR)](./docs/decisions/) — perché abbiamo scelto cosa
- 📚 [Glossario di dominio](./docs/glossario.md) — termini legali e fiscali italiani

## Stack tecnico

- **Frontend**: TanStack Start v1 (React 19, Vite 7, file-based routing)
- **Backend**: Lovable Cloud in uscita; target Supabase di proprietà del progetto con RLS, auth, edge functions e storage
- **Styling**: Tailwind v4 con token semantici in `src/styles.css`
- **UI**: shadcn/ui + Radix + lucide-react
- **Lingua UI**: italiano (`lang="it"`)

Dettagli in [`docs/guides/architettura.md`](./docs/guides/architettura.md).

## Stato del progetto

In sviluppo attivo. Per lo stato puntuale di ogni area vedi [`ROADMAP.md`](./ROADMAP.md).

## Licenza

Vedi [`LICENSE`](./LICENSE).
