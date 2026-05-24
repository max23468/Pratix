# Memoria di progetto

Questa cartella è uno **specchio leggibile** della memoria persistente di progetto che vive in `mem://`.

## Fonte di verità

> **`mem://*` resta la fonte di verità.** I file qui sotto sono mirror generati per essere leggibili dagli umani, indicizzabili da git, e per dare contesto a chi non ha accesso al runtime degli agenti.

Quando una regola cambia:

1. Aggiorni `mem://` (lo facciamo dagli agenti),
2. Aggiorni il file mirror corrispondente in questa cartella,
3. Se la modifica è significativa, registra una entry in [`../../CHANGELOG.md`](../../CHANGELOG.md).

## Indice

| File                               | Mirror di                         | Cosa contiene                                                           |
| ---------------------------------- | --------------------------------- | ----------------------------------------------------------------------- |
| [`core.md`](./core.md)             | `mem://index.md` (sezione _Core_) | Regole sempre attive, applicate a ogni intervento                       |
| [`brand.md`](./brand.md)           | `mem://design/brand`              | Riferimento brand completo                                              |
| [`roadmap.md`](./roadmap.md)       | `mem://process/roadmap`           | Puntatore a `docs/ROADMAP.md` e regola di sincronizzazione              |
| [`versioning.md`](./versioning.md) | `mem://process/versioning`        | Regole SemVer, changelog a tre categorie, pagina `/novita` e campanella |

## Cosa **non** mettere qui

- Note di sessione o log conversazionali (rumore, non valore)
- Mappa del codice (si legge dal repo)
- Schema database (vive in Supabase + `src/integrations/supabase/types.ts`)
- Storia delle modifiche (è in `CHANGELOG.md` e in git)
