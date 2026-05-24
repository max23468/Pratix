# Contesto operativo Pratix

## Stato progetto

- Fase: SaaS operativo maturo per avvocati freelance.
- Produzione: `https://pratix.vercel.app`.
- Stack: React/TanStack Start, Vercel, Supabase, Tailwind v4, shadcn/Radix.
- Versione corrente: vedi `src/lib/version.ts`.
- Roadmap canonica: `docs/ROADMAP.md`.
- Memoria mirror: `docs/memory/`.

## Perimetro

Pratix resta un gestionale leggero per avvocati freelance, con focus su recupero crediti, committenti, clienti, controparti, pratiche, attività fatturabili, prezzi, rimborsi spese, fatture e rendiconti Excel.

Fuori perimetro salvo decisione esplicita:

- studi associati e team multi-ruolo;
- CRM generalista;
- suite contabile completa;
- piattaforma enterprise;
- bot Telegram o approccio VPS-first.

## Fonti primarie

1. `AGENTS.md`
2. `README.md`
3. `docs/INDEX.md`
4. `docs/ROADMAP.md`
5. `docs/BACKLOG.md`
6. `docs/TOOLCHAIN.md`
7. `docs/memory/README.md`
8. `docs/glossario.md`
9. `docs/guides/versioning-e-release.md`
10. `docs/guides/deploy.md`
11. `docs/guides/architettura.md`
12. `docs/data-model.md`
13. `docs/decisions/`

## Vincoli da ricordare

- UI e documentazione utente in italiano.
- Glossario obbligatorio: Committente, Cliente, Controparte, Pratica, Attività, Compenso/Onorario, Prezzi, Rimborso spese, Fattura, Rendiconto Excel.
- Vietati nel prodotto: Caso, Assistito, Deadline, Costi.
- Colori solo via token semantici, niente hex inline.
- Logo solo tramite `<Logo />`.
- RLS sempre attiva per nuove tabelle user-owned.
- Non modificare manualmente `src/routeTree.gen.ts` o `src/integrations/supabase/types.ts`.
- Non spostare Pratix verso VPS, Telegram o Cloudflare senza decisione esplicita.

## Pubblicazione e release

- Pubblicare significa merge su `main`, verifica Vercel production quando serve e cleanup branch/worktree.
- Rilasciare significa `npm run release` secondo `docs/guides/versioning-e-release.md`.
- Per docs interne non esposte all'app, non serve bump SemVer.
- Prima di PR ready o merge controllare Codex feedback inbox.
- Dopo merge controllare branch locali e worktree temporanei.

## Prossimo lavoro di prodotto

La roadmap 2.0 punta a metodo operativo, controllo qualità, notifiche in-app, import rendiconti Excel e micro-feature mirate come Piano operativo della Pratica, Centro documenti Pratica e Bozze assistite.

Prima di implementare nuovo codice 2.0, definire il primo incremento minimo e le regole dell'import rendiconti: campi obbligatori, default, duplicati e comportamento su dati incerti.
