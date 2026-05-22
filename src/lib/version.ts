/**
 * Versione corrente di Pratix.
 *
 * Convenzione SemVer adattata a SaaS:
 * - MAJOR: cambia un comportamento visibile all'utente in modo non retrocompatibile
 *   (rimosso un campo, cambiata la logica di calcolo di una fattura, ecc.)
 * - MINOR: nuova funzionalità retrocompatibile (nuova pagina, nuovo campo opzionale)
 * - PATCH: bugfix, miglioramenti UI, contenuti, performance
 *
 * Per rilasciare una nuova versione:
 * 1. aggiungi le voci sotto `[Non rilasciato]` in `CHANGELOG.md`
 * 2. esegui `npm run release`
 * 3. verifica il diff generato
 * 4. promuovi e verifica il deployment di produzione su Vercel
 *
 * Vedi `docs/guides/versioning-e-release.md` per la procedura completa.
 */
export const APP_VERSION = "1.11.0";
export const BUILD_DATE = "2026-05-22";
