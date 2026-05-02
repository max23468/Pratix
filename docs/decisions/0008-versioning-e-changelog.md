# ADR-0008 — Versioning e changelog

Data: 2026-04-29
Stato: Accettata

## Contesto

Pratix è un'app SaaS hostata su Lovable, non una libreria distribuita. Quando
pubblichiamo, tutti gli utenti vedono immediatamente l'ultima versione: non
esiste un `npm install` né un tag che fa partire una pipeline di rilascio.

Tuttavia, due esigenze concrete richiedono un sistema di versioning leggero
ma disciplinato:

1. **Tracciabilità tecnica**: dato un bug riportato, sapere quale versione era
   online in quel momento.
2. **Comunicazione utenti**: il team è composto da uno sviluppatore/tester e
   un utilizzatore (avvocato). L'utilizzatore deve poter vedere "cosa è
   cambiato dall'ultima volta" senza dover leggere un changelog tecnico in
   inglese su GitHub.

## Decisione

Adottiamo **SemVer convenzionale** adattato al contesto SaaS, con un
changelog **Keep a Changelog** in italiano e una pagina "Novità"
in-app autenticata.

### Regole di versioning

| Bump              | Quando                                                                                                                                   |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **MAJOR** (X.0.0) | Cambia un comportamento visibile all'utente in modo non retrocompatibile (es. rimosso un campo fattura, cambiata una formula di calcolo) |
| **MINOR** (0.X.0) | Nuova funzionalità retrocompatibile (nuova pagina, nuovo campo opzionale, nuova vista)                                                   |
| **PATCH** (0.0.X) | Bugfix, miglioramenti UI, contenuti, performance, refactor invisibili                                                                    |

### Single source of truth

- `src/lib/version.ts` esporta `APP_VERSION` e `BUILD_DATE`. È l'unica
  costante di versione referenziata dal codice (footer Impostazioni,
  hook campanella, eventuali log).
- `CHANGELOG.md` (root) è l'elenco narrativo delle modifiche, sempre in
  italiano, formato Keep a Changelog. Ogni voce rilasciata ha titolo
  `## [X.Y.Z] — YYYY-MM-DD`.
- I lavori in corso vanno sotto `## [Non rilasciato]`. Al momento del
  rilascio, `npm run release` rinomina quel blocco con la nuova versione e la
  data, aggiorna `src/lib/version.ts`, crea il nuovo blocco non rilasciato e
  aggiorna i link del changelog.

### Pagina "Novità" in-app

- Route `/novita`, **autenticata** (sotto `AppLayout`).
- Parsa `CHANGELOG.md` a build time (import `?raw`) e mostra solo le
  versioni rilasciate.
- Tracciata in `profiles.last_seen_changelog_version` (testo, opzionale).
- Quando `APP_VERSION > last_seen_changelog_version` (o `last_seen` è
  null), la **campanella in topbar** mostra un puntino terracotta. Aprire
  la pagina segna la versione corrente come letta.

La pagina è solo autenticata perché un avvocato freelance non viene sul
sito pubblico per leggere il changelog: il cambio di versione è
informazione interna al prodotto.

### Procedura di rilascio

Vedi `docs/guides/versioning-e-release.md` per i passaggi operativi.
ADR-0010 documenta l'automazione locale del comando di release.

## Conseguenze

**Positive**

- Nuove versioni richiedono una singola azione meccanica locale
  (`npm run release`) più la promozione del deployment Vercel.
- L'utilizzatore non tecnico ha un canale dedicato per vedere le novità
  senza notifiche invasive (pallino discreto, non popup).
- Il supporto può chiedere "che versione vedi nel footer Impostazioni?"
  per debuggare regressioni.

**Negative**

- La disciplina dipende dal fatto che le voci siano scritte correttamente sotto
  `## [Non rilasciato]`: il comando automatizza il rilascio, non decide il
  contenuto narrativo del changelog.
- Il parser changelog è semplice (gestisce solo `### sezioni` e bullet
  list): formattazione complessa nel changelog non viene resa.

**Mitigazioni**

- La guida di rilascio include una checklist e un comando dry-run.
- Il footer Impostazioni mostra sempre versione corrente: una verifica
  visiva immediata dopo ogni Publish.

## Esclusioni esplicite

- **No tag git automatici**, no GitHub Releases, no pipeline di rilascio.
  Pratix vive su Lovable: il "rilascio" è premere Publish.
- **No notifiche push/email** per le novità. Solo il pallino in
  campanella.
- **No public roadmap/changelog**: la pagina Novità resta autenticata.

## Riferimenti

- `src/lib/version.ts`
- `src/lib/changelog.ts`
- `src/routes/novita.tsx`
- `CHANGELOG.md`
- `docs/guides/versioning-e-release.md`
