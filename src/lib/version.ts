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
 * 1. aggiorna `APP_VERSION` qui sotto
 * 2. aggiorna `BUILD_DATE` (formato YYYY-MM-DD)
 * 3. rinomina `[Non rilasciato]` in `CHANGELOG.md` con il nuovo numero e data
 * 4. premi "Publish" su Lovable
 *
 * Vedi `docs/guides/versioning-e-release.md` per la procedura completa.
 */
export const APP_VERSION = "0.2.0";
export const BUILD_DATE = "2026-04-29";
