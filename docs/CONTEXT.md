# Contesto operativo Pratix

## Stato progetto

- Fase: SaaS operativo maturo per avvocati freelance.
- Produzione: `https://pratix.vercel.app`.
- Stack: React/TanStack Start, Vercel, Supabase, Tailwind v4, shadcn/Radix.
- Versione corrente: vedi `src/lib/version.ts`.
- Roadmap canonica: `docs/ROADMAP.md`.
- Memoria mirror: `docs/memory/MEMORY_MIRROR.md` e file collegati.

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
7. `docs/memory/MEMORY_MIRROR.md`
8. `docs/glossario.md`
9. `docs/guides/versioning-e-release.md`
10. `docs/guides/deploy.md`
11. `docs/guides/architettura.md`
12. `docs/data-model.md`
13. `docs/DECISIONS.md`, `docs/DECISIONS_PENDING.md` e `docs/decisions/`

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
- Per modifiche docs-only/governance-only usare verifiche proporzionate:
  review documentale, coerenza link e `git diff --check`, senza smoke, deploy
  o release.

## Prossimo lavoro di prodotto

La roadmap 2.0 punta a metodo operativo, controllo qualità, notifiche in-app e
micro-feature mirate come Piano operativo della Pratica, Centro documenti
Pratica, Agenda operativa leggera e Dashboard 2.0.

Il Centro documenti Pratica è entrato nel core 2.0 come archivio operativo
leggero della singola Pratica: tab `Documenti` secondaria, lista unica di file
diretti e allegati Attività, categorie obbligatorie, note opzionali e filtri per
categoria/origine. Restano fuori fatturazione, rendiconti, stati documento,
segnali qualità e ricerca testuale.

Il primo incremento 2.0 approvato è il Controllo qualità operativo. I segnali
vanno salvati in tabella, con stati `aperto`, `risolto`, `ignorato` e
`rimandato`, gravità `da correggere`, `da verificare` o `suggerimento`, titolo
breve, motivo, azione proposta, azione primaria e collegamento a Pratica,
Cliente, Controparte, Attività o Fattura. La generazione avviene con cron
giornaliero e ricalcolo manuale; i segnali risolti restano nello storico ma non
nella vista normale.

Prima di implementare nuovo codice 2.0, preparare il piano tecnico del Controllo
qualità operativo: schema dati, RLS, server functions, generatore segnali, cron,
ricalcolo manuale e superfici UI minime.

Nota: i rendiconti Excel restano un output del prodotto; l'import rendiconti Excel non è più una feature 2.0 da sviluppare. Sui volumi limitati viene gestito manualmente con assistenza esterna all'app.

Nota: Bozze assistite è fuori dal perimetro 2.0 perché superflua ora; resta
parcheggiata come idea futura, da rivalutare solo dopo aver validato il metodo
operativo centrale.
