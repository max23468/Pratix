---
mirror_of: mem://process/versioning
---

# Versioning e changelog

> Mirror leggibile di `mem://process/versioning`. Fonte di verità: `mem://`. Aggiornare entrambi quando la regola cambia.

Pratix usa **SemVer convenzionale** adattato a SaaS hostato (no `npm publish`, no tag git manuale). "Rilasciare" = bump `version.ts` + rinomina blocco changelog + promozione deployment Vercel.

**Single source of truth**: `src/lib/version.ts` esporta `APP_VERSION` e `BUILD_DATE`. Mai duplicare la stringa di versione altrove.

## Regole di bump

- **MAJOR** = breaking visibile all'utente (rimosso campo, cambiata formula)
- **MINOR** = nuova feature retrocompatibile
- **PATCH** = bugfix / UI / contenuti

## Changelog

`CHANGELOG.md` in root, formato adattato da Keep a Changelog in italiano, sempre con blocco `## [Non rilasciato]` in cima. Voci scritte dal punto di vista utente (no commit-style, no riferimenti a file/PR).

### Tre categorie standard

In quest'ordine. Sceglierle bene è importante perché la pagina `/novita` le rende con gerarchia visiva diversa:

- `### Novità` — feature/miglioramenti che l'utente vede e usa → in evidenza con icona terracotta (Sparkles)
- `### Correzioni` — bugfix, sicurezza, fix di copy/glossario → compatte ma visibili (Wrench/ShieldCheck)
- `### Sotto il cofano` — refactor, asset rigenerati, migrazioni invisibili, dipendenze → collassate in `<details>` (Settings2)

Test mentale per scegliere: *"un avvocato che apre Pratix domani se ne accorge?"* → sì = Novità, no = Sotto il cofano. Sicurezza va sempre in Correzioni anche se invisibile.

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
