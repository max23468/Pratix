# Versioning e procedura di rilascio

Questa guida descrive **come rilasciare una nuova versione di Pratix**.

Decisione di riferimento: [ADR-0008](../decisions/0008-versioning-e-changelog.md).

## TL;DR

Per rilasciare la versione `X.Y.Z`:

1. Controlla che `CHANGELOG.md` abbia le voci corrette sotto `## [Non rilasciato]`.
2. Esegui `npm run release`.
3. Controlla il diff generato (`CHANGELOG.md` + `src/lib/version.ts`).
4. Promuovi il deployment di produzione su Vercel.
5. Verifica: apri `/impostazioni` e controlla che il footer mostri la nuova versione.

## Definizione di pubblicazione completa

In Pratix, quando il proprietario chiede "pubblica", "pubblica tutto" o
"è tutto pubblicato?", **pubblicato** significa:

1. branch di lavoro mergiato su `main`;
2. deployment production Vercel completato e verificato;
3. branch dedicato chiuso/eliminato, se esiste e non serve più.

Una PR aperta, un push sul branch o una preview Vercel non bastano. Se uno di
questi passaggi non è possibile, va dichiarato esplicitamente come residuo
operativo.

## Gate di chiusura fase

Prima di dichiarare conclusa una fase, migrazione, cutover o lavoro già
pubblicato/deployato, controlla `CHANGELOG.md`.

Se `## [Non rilasciato]` contiene voci relative al lavoro appena completato,
non chiudere il task senza:

1. eseguire `npm run release` e chiudere il blocco changelog; oppure
2. dichiarare esplicitamente che il rilascio resta il prossimo step operativo.

Per migrazioni, cutover, correzioni infra o bonifiche sotto il cofano completate
senza nuove feature utente, il default è PATCH salvo istruzione diversa o impatto
utente maggiore.

## Quando bumpare quale numero

Pratix segue **Semantic Versioning** adattato al contesto SaaS.

### MAJOR — `X.0.0`

Bump quando un cambiamento modifica un comportamento visibile all'utente in
modo **non retrocompatibile**. Esempi:

- Rimosso un campo dalla fattura (anche solo dal layout PDF).
- Cambiata una formula di calcolo (es. cassa, ritenuta).
- Cambiata una struttura dati che obbliga l'utente a ricompilare qualcosa.
- Rimossa o rinominata una pagina raggiungibile dal menu.

### MINOR — `0.X.0`

Bump per **nuove funzionalità retrocompatibili**. Esempi:

- Nuova pagina (es. "Novità", "Statistiche").
- Nuovo campo opzionale in un form.
- Nuovo formato di esportazione affiancato a uno esistente.
- Nuova integrazione (es. PEC, conservazione).

### PATCH — `0.0.X`

Bump per **fix e miglioramenti che non cambiano funzionalità**. Esempi:

- Bugfix.
- Miglioramenti UI / copy / accessibilità.
- Performance, refactor invisibili.
- Aggiornamento dipendenze senza impatto utente.

## Cosa scrivere nel changelog

Formato adattato da [Keep a Changelog](https://keepachangelog.com/it/1.1.0/),
sempre in **italiano** e dal punto di vista dell'utente (non commit-style).

### Tre categorie, in quest'ordine

Pratix usa **tre sezioni** invece delle classiche sei. La pagina `/novita`
le mostra con gerarchia visiva diversa, quindi scegliere bene la categoria
è importante quanto scrivere bene la voce.

- **`### Novità`** — funzionalità o miglioramenti che l'utente vede e usa
  (nuova pagina, nuovo campo, redesign visibile, miglior copy in un punto
  importante). In `/novita` sono **in evidenza** con icona terracotta.
- **`### Correzioni`** — bugfix, fix di sicurezza, fix di copy minori,
  correzioni di glossario. In `/novita` sono **compatte ma visibili**.
- **`### Sotto il cofano`** — refactor, asset rigenerati, migrazioni
  invisibili, dipendenze aggiornate, modifiche a build/deploy/processo.
  In `/novita` sono **collassate** in un blocco "mostra/nascondi" per non
  affollare la lettura.

> Se sei indubbio fra Novità e Sotto il cofano, chiediti: **un avvocato che
> apre Pratix domani se ne accorge?** Se sì → Novità. Se no → Sotto il cofano.

### Stile delle voci

- Frasi brevi, soggetto implicito ("Aggiunto X" non "Abbiamo aggiunto X").
- Niente riferimenti a file, commit, PR, issue: il changelog è per l'utente,
  non per gli sviluppatori.
- Termini di prodotto coerenti con il glossario: Pratica, Cliente, Scadenza,
  Spese, Fattura. Mai "studio".
- Bold (`**`) per evidenziare il nome di una funzionalità.

### Esempio buono

```md
## [0.3.0] — 2026-05-15

### Novità

- **Esportazione XML** delle fatture in formato FatturaPA TD06.
- Filtro per stato in elenco Pratiche.

### Correzioni

- Il logo non veniva incluso nel PDF della fattura.
- Glossario: rimossa la parola "studio" dall'onboarding.

### Sotto il cofano

- Asset social rigenerati con la nuova palette.
- Aggiornamento dipendenze interne (TanStack Router).
```

### Esempio da evitare

```md
- bump deps
- fix PR #42
- refactor invoice-pdf.ts
```

### Compatibilità con voci storiche

Le versioni `0.1.0` e `0.2.0` usano ancora i vecchi nomi di sezione
(`Aggiunto` / `Modificato` / `Sicurezza`). La pagina `/novita` li riconosce
e li mappa automaticamente: `Aggiunto` → Novità, `Modificato` e `Sicurezza`
→ Correzioni. Non serve riscrivere lo storico.

## Workflow consigliato durante lo sviluppo

Tutto il lavoro in corso si accumula sotto `## [Non rilasciato]`. Aggiungi
voci man mano, anche piccole. Quando decidi di rilasciare, scegli il bump
in base al contenuto accumulato:

- almeno una voce in **Rimosso** o un breaking change esplicito → MAJOR
- almeno una voce in **Novità** o **Aggiunto** → MINOR
- solo **Correzioni**, **Sotto il cofano** o voci storiche non-breaking → PATCH

## Comando automatizzato

Il comando standard è:

```sh
npm run release
```

Il comando:

- legge `CHANGELOG.md`;
- rifiuta il rilascio se `## [Non rilasciato]` è vuoto;
- inferisce il bump (`Novità`/`Aggiunto` = MINOR, sezioni breaking o `Rimosso` = MAJOR, altrimenti PATCH);
- aggiorna `src/lib/version.ts` (`APP_VERSION` + `BUILD_DATE`);
- rinomina `## [Non rilasciato]` in `## [X.Y.Z] — YYYY-MM-DD`;
- crea un nuovo blocco `## [Non rilasciato]` vuoto;
- aggiorna i link in fondo al changelog.

Varianti:

```sh
npm run release:dry-run
npm run release -- --bump patch
npm run release -- --bump minor
npm run release -- --bump major
npm run release -- --version 0.4.0
npm run release -- --date 2026-05-02
```

Usa `--bump` quando l'inferenza automatica non descrive bene l'impatto reale.
Usa `--version` solo quando serve una versione specifica.

## Procedura passo per passo

1. **Controlla il contenuto**: `## [Non rilasciato]` deve contenere solo voci
   da rilasciare ora.
2. **Simula se vuoi controllare il bump**:
   ```sh
   npm run release:dry-run
   ```
3. **Genera la release**:
   ```sh
   npm run release
   ```
4. **Controlla il diff**: devono cambiare solo `CHANGELOG.md` e
   `src/lib/version.ts`, salvo lavori collegati già presenti nel branch.
5. **Promuovi il deployment di produzione** su Vercel.
6. **Verifica**:
   - Apri `/impostazioni`: il footer deve mostrare `Pratix v0.3.0 · build 2026-05-15`.
   - Apri `/novita`: deve apparire la nuova versione in cima.
   - La campanella in topbar mostra il pallino fino a quando non visiti `/novita`.

## Cosa NON fare

- **Non** modificare retroattivamente versioni già rilasciate. Se serve un
  fix, fai un nuovo bump (PATCH).
- **Non** lasciare lavori completati sotto `[Non rilasciato]` dopo una
  pubblicazione completa: se vanno online ora, devono stare in una versione
  rilasciata.
- **Non** usare la pagina Novità per annunci di marketing: è cronologia
  tecnica narrata, non comunicazione promozionale.
- **Non** rendere pubblico `/novita`: il target sono gli utenti
  autenticati, non i visitatori della landing.
