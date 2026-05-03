# Come contribuire a Pratix

> Il repository è attualmente **privato**. Questo documento è predisposto per quando il progetto si aprirà a collaboratori esterni.

## Prima di iniziare

Leggi nell'ordine:

1. [`README.md`](./README.md) — panoramica e mappa
2. [`AGENTS.md`](./AGENTS.md) — regole operative obbligatorie
3. [`BRAND.md`](./BRAND.md) — identità di marca
4. [`ROADMAP.md`](./ROADMAP.md) — cosa è in lavorazione
5. [`docs/guides/`](./docs/guides/) — guide tematiche
6. [`docs/decisions/`](./docs/decisions/) — perché abbiamo scelto cosa

## Setup locale

```bash
npm ci
npm run dev
```

## Workflow operativo

GitHub è la fonte primaria del codice. Il repository remoto attuale è
`https://github.com/max23468/Pratix.git`.

Flusso consigliato:

1. Sincronizza `main` prima di iniziare.
2. Lavora su branch breve, preferibilmente `codex/<nome-task>` per lavoro
   guidato da Codex.
3. Mantieni le modifiche atomiche.
4. Esegui le verifiche pertinenti.
5. Apri PR o mergea solo dopo review dei file toccati.

Non usare editor o automazioni esterne in parallelo sulla stessa area mentre
Codex sta lavorando sul branch. GitHub resta la fonte primaria delle modifiche.

## Convenzioni

### Lingua

- **UI in italiano** (`lang="it"`), tono "tu" professionale.
- **Identificatori in inglese** quando coerente con framework e librerie.
- **Glossario obbligatorio**: Committente/Cliente/Controparte/Pratica/Attività/Compenso-Onorario/Prezzi/Rimborso spese/Fattura/Rendiconto Excel.

### Codice

- Componenti piccoli, riusabili, in `src/components/`.
- Hook in `src/hooks/`.
- Solo token semantici da `src/styles.css`, mai hex inline.
- Mai modificare manualmente: `src/integrations/supabase/types.ts`, `src/routeTree.gen.ts`, `.env`.

### Commit

Conventional Commits coerenti con l'impatto reale:

- `feat:` nuova funzionalità
- `fix:` correzione di bug
- `docs:` solo documentazione
- `refactor:` rifattorizzazione senza cambio comportamento
- `chore:` manutenzione (deps, config)
- `test:` aggiunta o modifica di test

Esempio: `feat(fatture): aggiunge esportazione massiva XML per periodo`.

### Pull request

Mantieni le PR atomiche e descrittive. Includi:

- cosa cambia e perché,
- aree toccate (frontend, backend, docs),
- verifiche eseguite (`npm run build`, `npm run lint`, eventuali test),
- rischi residui o limitazioni note.

### Verifiche prima del merge

```bash
npm run build
npm run lint
npm audit --audit-level=moderate   # se hai toccato dipendenze
```

Per modifiche al backend o alla pubblicazione consulta anche
[`docs/guides/database.md`](./docs/guides/database.md),
[`docs/guides/migrations.md`](./docs/guides/migrations.md) e
[`docs/guides/deploy.md`](./docs/guides/deploy.md).

### Documentazione

Se la tua modifica cambia comportamento utente, comandi, configurazione o decisioni di prodotto:

- aggiorna [`ROADMAP.md`](./ROADMAP.md) (stato della voce),
- aggiungi una entry in [`CHANGELOG.md`](./CHANGELOG.md) sotto `[Non rilasciato]`,
- se è una decisione architetturale, crea un nuovo ADR in [`docs/decisions/`](./docs/decisions/) seguendo il template,
- se cambia una regola di brand o tono, aggiorna `BRAND.md` e i mirror in `docs/memory/`.

## Sicurezza

Per segnalare vulnerabilità vedi [`SECURITY.md`](./SECURITY.md). Non aprire issue pubbliche per problemi di sicurezza.
