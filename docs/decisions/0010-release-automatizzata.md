# ADR 0010 — Release automatizzata locale

- **Stato**: Accettato
- **Data**: 2026-05-02
- **Decisori**: Matteo / Codex

## Contesto

ADR-0008 aveva introdotto versioning SemVer, `CHANGELOG.md`, pagina Novità e
campanella in-app. La parte prodotto era già automatizzata, ma la preparazione
di una release richiedeva ancora passaggi manuali: scegliere il bump, aggiornare
`src/lib/version.ts`, rinominare il blocco `## [Non rilasciato]`, creare il
nuovo blocco vuoto e aggiornare i link in fondo al changelog.

Questo esponeva il processo a errori piccoli ma fastidiosi: versione e changelog
disallineati, link mancanti, blocco non rilasciato lasciato pieno dopo una fase
già chiusa.

## Decisione

Automatizziamo la preparazione locale della release con `npm run release`.

Il comando:

- legge `CHANGELOG.md`;
- rifiuta il rilascio se `## [Non rilasciato]` è vuoto;
- inferisce il bump quando non viene passato esplicitamente;
- distingue la quarta categoria `### Non versionato`, che non genera una nuova
  versione SemVer;
- blocca il rilascio se il changelog mescola voci versionate e non versionate o
  contiene sezioni non riconosciute;
- aggiorna `src/lib/version.ts`;
- trasforma `## [Non rilasciato]` in `## [X.Y.Z] — YYYY-MM-DD`;
- crea un nuovo blocco `## [Non rilasciato]` vuoto;
- aggiorna i link di riferimento in fondo al changelog.

Restano intenzionali e non automatizzati: scrivere le voci del changelog,
verificare il diff e promuovere il deployment Vercel.

## Conseguenze

- Il rischio di dimenticare `APP_VERSION`, `BUILD_DATE` o i link del changelog
  scende sensibilmente.
- Il comando rende ripetibile il gate di chiusura fase: se esistono voci sotto
  `## [Non rilasciato]`, la chiusura operativa passa da `npm run release`.
- L'inferenza del bump è conservativa e va corretta con `--bump` quando il
  contenuto del changelog non racconta bene l'impatto reale.
- Non ogni modifica diventa automaticamente PATCH: bozze, commenti, test-only,
  appunti locali e documentazione interna non operativa rientrano nella
  categoria "nessuna release".

## Alternative considerate

- **Restare manuali** — Scartata: il processo era semplice, ma abbastanza
  ripetitivo da generare facilmente disallineamenti.
- **GitHub Releases/tag automatici** — Scartata: Pratix è un SaaS hostato su
  Vercel, non un pacchetto distribuito. Il rilascio operativo resta la
  promozione del deployment.
- **Bump automatico in CI** — Scartata: introdurrebbe mutazioni remote sul repo
  e più complessità di quanta serva al progetto.

## Riferimenti

- [`docs/guides/versioning-e-release.md`](../guides/versioning-e-release.md)
- [`scripts/release.mjs`](../../scripts/release.mjs)
- [`CHANGELOG.md`](../../CHANGELOG.md)
- [`src/lib/version.ts`](../../src/lib/version.ts)
