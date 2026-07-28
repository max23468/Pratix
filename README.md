# Pratix

> **Tutto torna.**
>
> Gestionale per avvocati freelance: pratiche, clienti, attività fatturabili, fatture (FatturaPA inclusa).

[![Stack](https://img.shields.io/badge/stack-TanStack%20Start-3B82F6)](#) [![Backend](https://img.shields.io/badge/backend-Supabase-orange)](#) [![Deploy](https://img.shields.io/badge/deploy-Vercel-black)](#) [![Lingua](https://img.shields.io/badge/lingua-italiano-green)](#)

---

## Cos'è Pratix

Pratix è il gestionale pensato per **avvocati freelance italiani**: nessun fronzolo, nessuna logica da grande studio associato. Solo gli strumenti che servono al singolo professionista per tenere in ordine pratiche, clienti, attività fatturabili e fatture, con piena conformità FatturaPA.

Il target esplicito è il **professionista singolo**: il prodotto evita il linguaggio degli studi associati (vedi [glossario](docs/glossario.md) e [tono di voce](docs/guides/tono-di-voce.md)).

## Avvio rapido

```bash
npm run setup   # usa npm 12 per installare le dipendenze
npm run dev     # avvia in locale
npm run build   # build di produzione
npm run lint    # linter
```

Le variabili d'ambiente (`.env`) non vanno committate. In produzione vivono su Vercel; il backend è il progetto Supabase di proprietà. Non modificare manualmente `src/integrations/supabase/types.ts` o `src/routeTree.gen.ts`.

## Mappa della documentazione

| File                                   | Cosa contiene                                                |
| -------------------------------------- | ------------------------------------------------------------ |
| [`README.md`](./README.md)             | Questo file: panoramica e indice                             |
| [`AGENTS.md`](./AGENTS.md)             | Regole operative per chi (umani o agenti) modifica il codice |
| [`BRAND.md`](./BRAND.md)               | Guidelines di marca complete                                 |
| [`docs/ROADMAP.md`](./docs/ROADMAP.md) | Stato del prodotto per area, con legenda ✅🟡⬜💤            |
| [`CHANGELOG.md`](./CHANGELOG.md)       | Storia delle modifiche significative                         |
| [`SECURITY.md`](./SECURITY.md)         | Come segnalare vulnerabilità                                 |
| [`CONTRIBUTING.md`](./CONTRIBUTING.md) | Come contribuire al progetto                                 |
| [`LICENSE`](./LICENSE)                 | Licenza d'uso                                                |
| [`docs/INDEX.md`](./docs/INDEX.md)     | Indice canonico della documentazione                         |

## Infrastruttura

Pratix usa GitHub come fonte primaria, Codex come ambiente principale, Supabase
di proprietà del progetto come backend e Vercel per pubblicazione e preview.

## Documentazione approfondita

- 📖 [Guide tematiche](./docs/guides/) — architettura, database, fatturazione, tema, tono di voce, deploy, release e smoke test
- 🧰 [Toolchain](./docs/TOOLCHAIN.md) — runtime, comandi, verifiche e provider
- 🧭 [Roadmap](./docs/ROADMAP.md) e [backlog](./docs/BACKLOG.md) — stato, priorità e idee parcheggiate
- 📌 [Contesto operativo](./docs/CONTEXT.md) — handoff rapido e vincoli da ricordare
- 🧠 [Memoria di progetto](./docs/memory/) — regole sempre attive (specchio leggibile di `mem://`)
- 🧭 [Decision log (ADR)](./docs/decisions/) — perché abbiamo scelto cosa
- 📚 [Glossario di dominio](./docs/glossario.md) — termini legali e fiscali italiani

## Stack tecnico

- **Frontend**: TanStack Start v1 (React 19, Vite 7, file-based routing)
- **Backend**: Supabase di proprietà del progetto con RLS, Auth passwordless, passkey dietro feature flag e Storage privato
- **Deploy**: Vercel, produzione su `https://pratix.vercel.app`
- **Styling**: Tailwind v4 con token semantici in `src/styles.css`
- **UI**: shadcn/ui + Radix + lucide-react
- **Lingua UI**: italiano (`lang="it"`)

Dettagli in [`docs/guides/architettura.md`](./docs/guides/architettura.md).

## Stato del progetto

In sviluppo attivo. Per lo stato puntuale di ogni area vedi [`docs/ROADMAP.md`](./docs/ROADMAP.md).

## Licenza

Vedi [`LICENSE`](./LICENSE).
