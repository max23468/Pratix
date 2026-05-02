---
mirror_of: mem://process/versioning
---

# Versioning e changelog

> Mirror leggibile di `mem://process/versioning`. Fonte di verità: `mem://`. Aggiornare entrambi quando la regola cambia.

Pratix usa **SemVer convenzionale** adattato a SaaS hostato (no `npm publish`, no tag git manuale). "Rilasciare" = `npm run release` + verifica diff + promozione deployment Vercel.

"Pubblicare" / "tutto pubblicato" = merge su `main` + deployment production Vercel completato e verificato + branch dedicato chiuso/eliminato se esiste. Una PR aperta, un push sul branch o una preview Vercel non bastano.

**Single source of truth**: `src/lib/version.ts` esporta `APP_VERSION` e `BUILD_DATE`. Mai duplicare la stringa di versione altrove.

## Gate di chiusura fase

Prima di dichiarare conclusa una fase, migrazione, cutover o lavoro già pubblicato/deployato, controllare `CHANGELOG.md`.

Se il blocco `## [Non rilasciato]` contiene voci relative al lavoro appena completato, l'agente non deve chiudere il task senza:

- eseguire `npm run release` e chiudere il blocco changelog; oppure
- dichiarare esplicitamente che il rilascio resta il prossimo step operativo.

Per migrazioni, cutover, correzioni infra o bonifiche sotto il cofano completate senza nuove feature utente, il default è PATCH salvo istruzione diversa o impatto utente maggiore.

## Regole di bump

- **MAJOR** = breaking visibile all'utente o sui dati (campo rimosso, formula cambiata, formato export incompatibile, migration distruttiva)
- **MINOR** = nuova feature retrocompatibile (pagina, campo opzionale, vista, integrazione, formato aggiuntivo)
- **PATCH** = bugfix / UI / contenuti / sicurezza / runtime / deploy / processo di release consegnato col prodotto
- **Nessuna release** = interventi senza effetto su prodotto pubblicato, deploy o supporto (bozze, note locali, test-only, commenti, formattazione isolata, docs interne non operative)

Tutte le modifiche devono rientrare in una di queste quattro categorie. Se il blocco `[Non rilasciato]` contiene solo `### Non versionato`, `npm run release` deve riconoscere la categoria e non generare una nuova versione. Se mescola voci versionate e non versionate, deve fermarsi.

## Automazione release

Comando standard: `npm run release`.

Il comando legge il blocco `## [Non rilasciato]`, rifiuta il rilascio se è vuoto, inferisce il bump quando possibile (`Novità`/`Aggiunto` = MINOR, sezioni breaking/`Rimosso` = MAJOR, `Correzioni`/`Sotto il cofano` = PATCH, solo `Non versionato` = nessuna release), aggiorna `src/lib/version.ts`, rinomina il blocco in `## [X.Y.Z] — YYYY-MM-DD`, crea un nuovo `## [Non rilasciato]` vuoto e aggiorna i link in fondo a `CHANGELOG.md`. Se trova sezioni non riconosciute o mescola voci versionate e non versionate, si ferma.

Varianti utili:

- `npm run release:dry-run` per vedere cosa succederebbe senza scrivere file.
- `npm run release -- --bump patch|minor|major` per forzare il bump.
- `npm run release -- --bump none` per dichiarare esplicitamente nessuna release.
- `npm run release -- --version X.Y.Z` per forzare una versione specifica.
- `npm run release -- --date YYYY-MM-DD` per forzare la data.

## Changelog

`CHANGELOG.md` in root, formato adattato da Keep a Changelog in italiano, sempre con blocco `## [Non rilasciato]` in cima. Voci scritte dal punto di vista utente (no commit-style, no riferimenti a file/PR).

### Tre categorie standard

In quest'ordine. Sceglierle bene è importante perché la pagina `/novita` le rende con gerarchia visiva diversa:

- `### Novità` — feature/miglioramenti che l'utente vede e usa → in evidenza con icona terracotta (Sparkles)
- `### Correzioni` — bugfix, sicurezza, fix di copy/glossario → compatte ma visibili (Wrench/ShieldCheck)
- `### Sotto il cofano` — refactor, asset rigenerati, migrazioni invisibili, dipendenze → collassate in `<details>` (Settings2)

Test mentale per scegliere: _"un avvocato che apre Pratix domani se ne accorge?"_ → sì = Novità, no = Sotto il cofano. Sicurezza va sempre in Correzioni anche se invisibile.

### Compatibilità storica

Voci `Aggiunto` → Novità, `Modificato`/`Sicurezza` → Correzioni. Mappatura in `categorize()` di `src/routes/novita.tsx`. **Non riscrivere lo storico** (0.1.0, 0.2.0).

### Gerarchia per serie MAJOR.MINOR

La pagina `/novita` raggruppa le release per famiglia (es. `0.2.x` contiene 0.2.0, 0.2.1, 0.2.2…). Ogni serie è una card unica: l'ultima patch è espansa, le precedenti della stessa serie sono dentro un `<details>` "Versioni precedenti della serie". Questo evita liste lunghe di patch e dà rilievo alle release MINOR/MAJOR. Implementato in `groupBySeries()` + `seriesKey()`.

## Pagina Novità

Route `/novita`, **solo autenticata**. Parser semplice in `src/lib/changelog.ts` che importa `CHANGELOG.md?raw` a build time. Mostra solo le versioni rilasciate. Quando montata segna `APP_VERSION` come letta.

## Campanella topbar

`<ChangelogBell>` accanto al nome attività in `app-layout.tsx`. Pallino terracotta (`var(--brand-gold)`) quando `APP_VERSION > profiles.last_seen_changelog_version`. Hook `useUnreadChangelog`.

## DB

Campo `last_seen_changelog_version` (text, nullable) in `profiles`.

## Footer Impostazioni

Mostra `Pratix v{APP_VERSION} · build {BUILD_DATE}` + link "Cosa è cambiato" → `/novita`.

## Esclusioni esplicite

No notifiche push/email, no GitHub Releases, no changelog pubblico, no popup invasivi.

## Riferimenti

- [`docs/decisions/0008-versioning-e-changelog.md`](../decisions/0008-versioning-e-changelog.md)
- [`docs/guides/versioning-e-release.md`](../guides/versioning-e-release.md)
