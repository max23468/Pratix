# Audit riferimenti Lovable

Aggiornato: 2026-05-02.

Questo audit distingue i riferimenti operativi da quelli storici dopo la
migrazione tecnica fuori da Lovable.

## Esito sintetico

- **Runtime e configurazione**: puliti. La ricerca mirata su `src`,
  `package.json`, `vite.config.ts`, `supabase/config.toml` e file env tracciati
  non trova riferimenti Lovable.
- **Documentazione operativa corrente**: pulita. `AGENTS.md`, `README.md`,
  `CONTRIBUTING.md`, `SECURITY.md`, guide `deploy`, `database`, `migrations`,
  `architettura`, `versioning` e mirror `docs/memory` non contengono riferimenti
  Lovable.
- **Riferimenti storici**: restano in documenti di migrazione, ADR, changelog e
  inventari sanitizzati. Sono accettabili come storico dopo la migrazione.
- **Lovable**: resta parcheggiato come archivio temporaneo non operativo; non è
  parte di runtime, backend, publish o gestione dati.

## Riferimenti storici rimasti

| Area                  | File                                                | Stato                                     | Azione finale                                                    |
| --------------------- | --------------------------------------------------- | ----------------------------------------- | ---------------------------------------------------------------- |
| Piano migrazione      | `docs/guides/uscita-lovable.md`                     | Storico + checklist dismissione differita | Archiviare o rimuovere dopo la chiusura definitiva               |
| Inventario migrazione | `docs/migration/lovable-inventory.md`               | Storico sanitizzato                       | Tenere come archivio o rimuovere se si vuole zero match assoluto |
| Decision log          | `docs/decisions/0001-stack-tanstack-start.md`       | ADR storico                               | Tenere se si conserva lo storico decisionale                     |
| Decision log          | `docs/decisions/0002-lovable-cloud-supabase.md`     | ADR sostituito                            | Tenere come decisione storica sostituita                         |
| Decision log          | `docs/decisions/0008-versioning-e-changelog.md`     | ADR storico con vecchio processo          | Valutare aggiornamento o nota di superseding                     |
| Decision log          | `docs/decisions/0009-uscita-completa-da-lovable.md` | ADR della migrazione completata           | Tenere come decisione architetturale                             |
| Changelog             | `CHANGELOG.md`                                      | Storico release                           | Non riscrivere salvo scelta esplicita                            |
| Roadmap               | `ROADMAP.md`                                        | Stato migrazione e dismissione differita  | Aggiornare solo quando Lovable viene chiuso o scollegato         |
| Indice docs           | `docs/README.md`                                    | Link a documenti storici                  | Aggiornare se i documenti vengono archiviati o rimossi           |

## Gate operativo

Il gate corrente non richiede zero match assoluto su tutto il repository, perche
i riferimenti storici sono stati autorizzati. Richiede invece zero match sui
file operativi e di runtime:

```bash
rg -i "lovable|@lovable\\.dev" AGENTS.md README.md CONTRIBUTING.md SECURITY.md docs/guides/architettura.md docs/guides/database.md docs/guides/deploy.md docs/guides/migrations.md docs/guides/versioning-e-release.md docs/memory/core.md docs/memory/versioning.md src package.json vite.config.ts supabase/config.toml
```

Il gate finale puo diventare zero match assoluto solo se si decide di rimuovere
anche ADR, changelog e documenti di migrazione storici.
