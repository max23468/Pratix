# Piano — Update latest dipendenze e toolchain

- **Stato**: chiuso e pubblicato; Fasi 0-7 completate, release pubblicate e produzione verificata
- **Data**: 2026-05-08
- **Ambito**: aggiornamento a latest assoluto di dipendenze npm, tooling locale, runtime Node, CLI operative e verifiche di deploy
- **Tipo modifica attesa**: sotto il cofano, con probabile release PATCH se entra in runtime o build

## Obiettivo

Portare Pratix alle versioni latest disponibili delle componenti governate dal
repository, mantenendo funzionanti build, lint, routing TanStack Start,
integrazione Supabase, deploy Vercel e UI autenticata.

Il perimetro include:

1. dipendenze runtime in `package.json`;
2. devDependencies e toolchain di build/lint/format;
3. `package-lock.json`, lockfile autoritativo;
4. CLI operative usate via `npx`, in particolare Supabase e Vercel;
5. compatibilità Node/npm locale, CI e Vercel;
6. eventuali aggiornamenti minimi a configurazioni vicine come
   `vite.config.ts`, `eslint.config.js`, `tsconfig.json`, `components.json` e
   `vercel.json`.
7. workflow GitHub Actions, Dependabot e hook locali che eseguono Node/npm;
8. script custom in `scripts/` e `.github/scripts/` che possono risentire di
   Node, npm, ESLint, Prettier o API GitHub;
9. file generati/locali da non committare, in particolare `supabase/.temp/`,
   `.DS_Store`, `.vercel` e output di build.

Non rientrano nel piano nuove funzionalità prodotto, refactor UI non richiesti,
nuovi provider, nuovi workflow GitHub Actions o cambi architetturali non
necessari all'update.

## Stato rilevato al 2026-05-08

Ambiente locale osservato:

| Area                  | Stato                                   |
| --------------------- | --------------------------------------- |
| Branch                | `main`                                  |
| Worktree              | pulito                                  |
| Node locale           | `v26.0.0`                               |
| npm locale            | `11.14.1`                               |
| Node GitHub Actions   | `22` in `.github/workflows/quality.yml` |
| Node dichiarato repo  | assente in `package.json`               |
| Ultima release Pratix | `0.12.4`                                |
| Package manager       | npm                                     |
| Lockfile              | `package-lock.json`                     |

Dipendenze risultate aggiornabili o da verificare:

| Pacchetto                     | Stato osservato | Latest rilevata | Rischio     |
| ----------------------------- | --------------- | --------------- | ----------- |
| `@supabase/supabase-js`       | `2.105.1`       | `2.105.4`       | basso       |
| `react`                       | `19.2.5`        | `19.2.6`        | basso       |
| `react-dom`                   | `19.2.5`        | `19.2.6`        | basso       |
| `react-hook-form`             | `7.72.1`        | `7.75.0`        | basso/medio |
| `react-resizable-panels`      | `4.10.0`        | `4.11.0`        | basso       |
| `typescript-eslint`           | `8.58.2`        | `8.59.2`        | basso/medio |
| `prettier`                    | `3.8.2`         | `3.8.3`         | basso       |
| `vite`                        | `7.3.3`         | `8.0.11`        | alto        |
| `@vitejs/plugin-react`        | `5.2.0`         | `6.0.1`         | medio/alto  |
| `eslint`                      | `9.39.4`        | `10.3.0`        | alto        |
| `@eslint/js`                  | `9.39.4`        | `10.0.1`        | alto        |
| `typescript`                  | `5.9.3`         | `6.0.3`         | alto        |
| `globals`                     | `15.15.0`       | `17.6.0`        | medio       |
| `eslint-plugin-react-hooks`   | `5.2.0`         | `7.1.1`         | medio/alto  |
| `eslint-plugin-react-refresh` | `0.4.26`        | `0.5.2`         | medio       |
| `lucide-react`                | `0.575.0`       | `1.14.0`        | medio       |
| `react-day-picker`            | `9.14.0`        | `10.0.0`        | alto        |
| `recharts`                    | `2.15.4`        | `3.8.1`         | alto        |
| `zod`                         | `3.25.76`       | `4.4.3`         | alto        |

CLI operative latest osservate:

| Tool         | Latest rilevata | Nota                                                    |
| ------------ | --------------- | ------------------------------------------------------- |
| Supabase CLI | `2.98.2`        | oggi usata via `npx supabase ...`                       |
| Vercel CLI   | `53.2.0`        | utile per ispezione/deploy, non runtime app             |
| shadcn CLI   | `4.7.0`         | da usare solo se serve aggiornare componenti o registry |

Prima di implementare va rieseguito l'inventario, perché le latest sono dati
variabili.

## Decisione Node

Node 26 è la release Node più recente, ma non è la latest LTS. Al 2026-05-08
Node pubblica `v24.15.0` come latest LTS e `v26.1.0` come latest release.

Vercel documenta invece le versioni Node disponibili per build e functions come
`24.x`, `22.x` e `20.x`, con `24.x` default. Vercel permette override tramite
`engines.node`, ma solo sulle major disponibili.

Quindi ci sono due strade:

1. **Latest assoluto locale**: sviluppare e validare su Node 26/npm 11.
   È coerente con la richiesta "latest assoluto", ma non replica il runtime
   Vercel finché Vercel non espone Node 26.
2. **Parità production-first**: pin esplicito a Node `24.x`, latest LTS
   supportata da Vercel. Non è un downgrade tecnico dell'app: è allineamento
   con la piattaforma di produzione.

Decisione proposta per questo update: mantenere Node 26 come ambiente locale di
stress test, ma verificare e documentare anche la build con Node 24 prima del
merge. Se Vercel resta su `24.x`, non forzare `engines.node` a `26.x`.

Se l'update passa solo su Node 26 ma fallisce su Node 24, l'update non è pronto
per Pratix.

Azioni da includere nell'implementazione:

1. portare `.github/workflows/quality.yml` da Node 22 a Node 24;
2. valutare l'aggiunta di `engines.node` in `package.json` come range
   compatibile con Vercel e con lo stress test locale, ad esempio `>=24 <27`;
3. non inserire `engines.node: 26.x` finché Vercel non supporta Node 26;
4. se viene aggiunto `packageManager`, usare solo npm e verificare che non
   interferisca con Vercel/CI.

## Strategia di aggiornamento

L'aggiornamento va fatto a blocchi, non con un singolo `npm install package@latest`
di massa, perché i major di TypeScript, ESLint, Vite, Zod, Recharts e
React Day Picker possono richiedere interventi diversi.

### Fase 0 — Preparazione

1. Creare branch dedicato: `codex/update-latest-dipendenze`.
2. Aggiornare la base locale: `git pull --ff-only`.
3. Installare pulito: `npm ci`.
4. Eseguire baseline:
   - `npm run build`
   - `npm run lint`
   - `npm audit --audit-level=moderate`
5. Inventario aggiornato:
   - `npm outdated --json`
   - `npm ls --depth=0`
   - `npm view <pacchetto> version` per i pacchetti critici.
6. Controllo stack esterno al bundle:
   - `.github/workflows/*.yml`
   - `.github/dependabot.yml`
   - `.githooks/pre-push`
   - `scripts/*.mjs`
   - `.github/scripts/*.mjs`
   - `vercel.json`
   - `supabase/config.toml`
   - `.gitignore`

### Fase 1 — Patch/minor a basso rischio

Aggiornare prima i pacchetti compatibili e vicini:

```sh
npm install @supabase/supabase-js@latest react@latest react-dom@latest react-hook-form@latest react-resizable-panels@latest prettier@latest typescript-eslint@latest
```

Verifiche minime:

```sh
npm run format:changed:check
npm run build
npm run lint
npm audit --audit-level=moderate
```

### Fase 2 — Toolchain major

Aggiornare in un blocco controllato:

```sh
npm install -D vite@latest @vitejs/plugin-react@latest typescript@latest eslint@latest @eslint/js@latest globals@latest eslint-plugin-react-hooks@latest eslint-plugin-react-refresh@latest
```

Controlli attesi:

1. leggere eventuali migration guide di Vite 8, TypeScript 6 ed ESLint 10;
2. aggiornare `eslint.config.js` solo se nuove regole o API lo richiedono;
3. aggiornare `tsconfig.json` solo per opzioni incompatibili o deprecate;
4. verificare `vite.config.ts`, in particolare TanStack Start, Nitro,
   Tailwind e lo shim `tailwind-register-hooks-compat.mjs`;
5. rigenerare il route tree solo tramite build/plugin, mai a mano.

Gate:

```sh
npm run build
npm run lint
npm run format:changed:check
```

### Fase 3 — Major runtime/UI

Stato al 2026-05-08: completata localmente. Versioni installate:

| Pacchetto          | Versione installata |
| ------------------ | ------------------- |
| `zod`              | `4.4.3`             |
| `react-day-picker` | `10.0.0`            |
| `recharts`         | `3.8.1`             |
| `lucide-react`     | `1.14.0`            |

Gate superati: `npm run build`, `npm run lint`,
`npm run format:changed:check`, `npm audit --audit-level=moderate` e
`npm outdated --json` senza pacchetti npm residui da aggiornare.

Aggiornare uno alla volta o in micro-batch:

```sh
npm install zod@latest
npm install react-day-picker@latest
npm install recharts@latest
npm install lucide-react@latest
```

Superfici da controllare:

| Pacchetto          | Superfici Pratix da verificare                                 |
| ------------------ | -------------------------------------------------------------- |
| `zod`              | form, server functions, Creazione guidata, validazioni fatture |
| `react-day-picker` | selettori data, filtri per periodo, fatturazione, attività     |
| `recharts`         | dashboard e grafici                                            |
| `lucide-react`     | sidebar, topbar, pulsanti, empty state                         |

Per ogni pacchetto:

1. aggiornare import/API se cambiate;
2. evitare refactor UI non necessari;
3. mantenere testi italiani e token semantici;
4. eseguire build/lint dopo il fix.

### Fase 4 — shadcn/Radix

Stato al 2026-05-09: completata come verifica conservativa, senza
sovrascrivere componenti. `npx shadcn@latest --version` restituisce `4.7.0` e
`npx shadcn@latest info --json` riconosce il progetto come TanStack Start,
Tailwind v4, base Radix, stile `new-york`, icone Lucide e 45 componenti
installati.

Esito:

1. `npm outdated --json` non segnala pacchetti npm residui;
2. le dipendenze Radix e UI correlate risultano installate alle versioni
   risolte latest nel lockfile;
3. `npx shadcn@latest add --all --dry-run` non è utilizzabile come gate, perché
   la registry prova a risolvere anche `combobox`, non disponibile come item
   separato per questo stile;
4. il dry-run sui componenti realmente installati proporrebbe overwrite massivo
   di 47 file, nuove CSS vars e dipendenze non coerenti con l'update già fatto,
   inclusa una proposta di `recharts@2.15.4`;
5. i diff mirati su `calendar`, `chart`, `form` e `sidebar` sono stati
   verificati e non contengono fix funzionali da portare a mano.

Decisione: non applicare aggiornamenti shadcn massivi. I componenti locali
restano la fonte coerente per Pratix; eventuali refresh futuri vanno gestiti per
singolo componente con `--dry-run` e `--diff`, preservando token semantici,
Tailwind v4 e personalizzazioni locali.

Non aggiornare componenti shadcn in modo massivo senza necessità. Il repo usa
`components.json` con stile `new-york`, Tailwind CSS variables e icone Lucide.

Procedura:

1. verificare la CLI latest con `npx shadcn@latest --version`;
2. usare `npx shadcn@latest diff` se disponibile per i componenti toccati;
3. aggiornare solo componenti necessari a compatibilità React/Radix;
4. non introdurre nuove dipendenze UI o nuovi pattern grafici.

### Fase 5 — CLI e piattaforma

Stato al 2026-05-09: completata come verifica CLI/piattaforma senza pinning e
senza operazioni remote.

Versioni latest verificate:

| Tool         | Latest verificata | Esito operativo                                                                       |
| ------------ | ----------------- | ------------------------------------------------------------------------------------- |
| Supabase CLI | `2.98.2`          | `npx --yes supabase@latest --version` ok                                              |
| Vercel CLI   | `53.2.0`          | `npx --yes vercel@latest --version` ok; warning `EBADENGINE` con Node locale `26.0.0` |

Comandi Supabase usati dagli script del repo verificati via `--help`:

1. `supabase db advisors --linked --type security|performance`;
2. `supabase db push --linked --dry-run`;
3. `supabase gen types typescript --linked --schema public`.

Comandi Vercel verificati in sola lettura/help:

1. `vercel --help`;
2. `vercel pull --help`;
3. `vercel inspect --help`.

Decisione: non aggiungere Supabase CLI o Vercel CLI alle `devDependencies`.
Pratix continua a usare `npx supabase ...` per i comandi DB e `npx
vercel@latest ...` solo per ispezioni/deploy operativi quando servono. Il
pinning non aggiunge valore nel branch attuale e aumenterebbe rumore nel
lockfile; se una CLI diventa parte di un gate CI riproducibile, va rivalutato in
una modifica dedicata.

Nota Node/Vercel: la CLI Vercel latest funziona, ma su Node 26 mostra un warning
di engine per una dipendenza transitiva che supporta Node `20/22/24`, non Node 26. Questo rafforza la decisione già presa: la readiness per merge va verificata
su Node 24 nella Fase 5B, senza forzare Node 26 come runtime Vercel.

Igiene locale verificata: `.vercel`, `supabase/.temp/` e `.DS_Store` sono
ignorati da Git e non vanno committati.

Supabase CLI e Vercel CLI oggi non sono pin in `package.json`; i comandi usano
`npx`. Durante l'update:

1. verificare `npx supabase@latest --version`;
2. verificare `npx vercel@latest --version` solo se serve ispezione deploy;
3. decidere se pinning in `devDependencies` è utile.

Decisione proposta: non pinning di default. Pin solo se emerge instabilità o
se i comandi DB diventano parte di un gate riproducibile da CI.

### Fase 5B — CI, automazioni e file locali

Stato al 2026-05-09: completata localmente.

Aggiornamenti applicati:

1. `package.json` dichiara `packageManager: npm@11.14.1`;
2. `package.json` e `package-lock.json` dichiarano `engines.node: >=24 <27` e
   `engines.npm: >=11 <12`, così il repo resta compatibile con Node 24/Vercel e
   con lo stress test locale su Node 26;
3. `.github/workflows/quality.yml` usa `actions/setup-node@v5` con
   `node-version: 24`;
4. `.github/workflows/codex-pr-comments.yml` aggiunge `actions/setup-node@v5`
   con `node-version: 24`, invece di dipendere dal Node preinstallato del
   runner.

Verifiche completate:

1. `actions/checkout@v5` e `actions/setup-node@v5` sono già usati dove serve;
2. `quality.yml` mantiene `npm ci`, cache npm e audit condizionato sui cambi a
   `package.json`/`package-lock.json`;
3. `dependabot.yml` copre npm e GitHub Actions, con major TanStack Router Plugin
   ignorata perché gestita manualmente;
4. `.githooks/pre-push`, `scripts/prepush-guard.mjs`,
   `scripts/format-changed.mjs`, `scripts/release.mjs`,
   `scripts/db-verify.mjs`, `scripts/recreate-supabase-user.mjs` e
   `.github/scripts/handle-codex-pr-comments.mjs` passano `node --check`;
5. `.vercel`, `supabase/.temp/`, `.DS_Store`, `.output` e `node_modules` sono
   ignorati da Git;
6. Node 24 reale verificato con `npx --yes -p node@24 node -v`, che restituisce
   `v24.15.0`;
7. build e lint passano anche con `npx --yes -p node@24 -p npm@11 npm run ...`.

Nota: Vercel documenta `24.x` come default e versioni disponibili `24.x`,
`22.x`, `20.x`; Node documenta `24.15.0` come latest LTS e `26.1.0` come latest
release. La configurazione scelta mantiene la parità production-first senza
rinunciare al controllo locale su Node 26.

Aggiornare o verificare anche:

1. GitHub Actions:
   - `actions/checkout@v5`;
   - `actions/setup-node@v5`;
   - `node-version` della Quality Action, da allineare a `24`;
   - uso di `npm ci`, cache npm e audit condizionato.
2. Dependabot:
   - configurazione npm;
   - configurazione GitHub Actions;
   - ignore manuale di `@tanstack/router-plugin` major, da non considerare un
     blocco perché l'update latest viene gestito manualmente.
3. Hook locali:
   - `.githooks/pre-push`;
   - `scripts/prepush-guard.mjs`;
   - `scripts/format-changed.mjs`.
4. Script custom:
   - `scripts/release.mjs`;
   - `scripts/db-verify.mjs`;
   - `scripts/recreate-supabase-user.mjs`;
   - `.github/scripts/handle-codex-pr-comments.mjs`.
5. Igiene repo:
   - confermare che `supabase/.temp/`, `.vercel`, `.DS_Store`, output di build
     e file con dati personali restino ignorati;
   - non committare artefatti locali o secret;
   - se compaiono file temporanei già tracciati, trattarli come cleanup
     separato e dichiararlo.

### Fase 6 — Verifiche applicative

Gate obbligatori prima di considerare il branch pronto:

```sh
npm run format:changed:check
npm run build
npm run lint
npm audit --audit-level=moderate
npm run ci:local
```

Se cambia Supabase o se emergono warning DB:

```sh
npm run db:push:dry-run
npm run db:verify
```

Smoke test manuali/browser:

1. landing pubblica;
2. login;
3. dashboard;
4. pratiche;
5. attività;
6. committenti, clienti e controparti;
7. fatture e generazione PDF/XML;
8. Creazione guidata manuale;
9. account/impostazioni;
10. tema chiaro/scuro;
11. mobile e desktop.

Esito Fase 6 (2026-05-09):

1. gate locali completati con esito positivo:
   - `npm run format:changed:check`;
   - `npm run build`;
   - `npm run lint`;
   - `npm audit --audit-level=moderate`;
   - `npm run ci:local`.
2. preview locale avviata con `npm run preview -- --host 127.0.0.1 --port
4173`;
3. smoke browser pubblico completato su `/`, `/login`, `/register`,
   `/recupera-password`, `/reimposta-password`, `/privacy` e `/termini`:
   status 200, title/H1 attesi e nessun overflow orizzontale;
4. smoke mobile completato sulla landing a 390x844 senza overflow orizzontale;
5. tema verificato con persistenza `pratix.theme` in modalità `dark` e `light`;
6. form pubblici verificati dopo idratazione React:
   - login con credenziali errate mostra `Credenziali non valide`;
   - registrazione valida la lunghezza di nome e cognome;
   - recupero password mostra lo stato `Controlla la tua casella.`;
7. route protette non autenticate (`/dashboard`, `/pratiche`, `/attivita`,
   `/committenti`, `/clienti`, `/controparti`, `/fatture`, `/fatture/nuova`,
   `/creazione-guidata`, `/account`, `/impostazioni`, `/novita`) reindirizzano
   correttamente a `/login`;
8. console browser senza errori inattesi: i 404 locali su
   `/_vercel/insights/script.js` e `/_vercel/speed-insights/script.js` sono
   attesi in preview locale fuori da Vercel; il 400 auth è atteso nel test di
   login con credenziali errate.

Limite residuo: i flussi autenticati profondi (dashboard con dati reali,
pratiche, attività, generazione PDF/XML fatture, Creazione guidata e impostazioni
account) non sono stati eseguiti end-to-end perché questa fase non dispone di
una sessione utente test autenticata e fixture anonime dedicate. Restano da
validare in Fase 7 o prima del merge/deploy con credenziali test controllate.

### Fase 7 — Chiusura release

Aggiornare:

1. `CHANGELOG.md` sotto `[Non rilasciato]`, sezione `Sotto il cofano`;
2. `ROADMAP.md`, marcando questa voce come completata;
3. eventuali guide solo se cambia una procedura stabile.

Versioning:

1. se l'update resta tecnico ma cambia runtime/build app, usare PATCH;
2. se ci sono regressioni o cambi utente-visibili, valutare voce specifica in
   `Correzioni` o `Novità`;
3. se resta solo piano documentale, nessuna release.

Pubblicazione:

1. commit atomico Conventional Commit;
2. controllare la issue GitHub `Codex feedback inbox`;
3. aprire PR con template repo;
4. attendere check;
5. merge su `main`;
6. verificare deployment Vercel production `READY`;
7. smoke test su `https://pratix.vercel.app`;
8. pulire branch remoto e locale.

Esito Fase 7 locale (2026-05-09):

1. release PATCH `0.12.5` preparata con `npm run release -- --bump patch`;
2. `ROADMAP.md` aggiornata marcando l'update latest come completato;
3. risolti i due thread actionable della `Codex feedback inbox`:
   - script npm core resi cross-platform con wrapper Node per Vite;
   - blocchi `Non versionato` esclusi dalla lista pubblica `/novita`;
4. thread GitHub storici marcati come risolti e sync inbox avviato via workflow
   `Codex PR comments`;
5. gate locali completati con esito positivo:
   - `npm run format:changed:check`;
   - `npm run ci:local`;
   - `npx --yes -p node@24 -p npm@11 npm run build`;
   - `npx --yes -p node@24 -p npm@11 npm run lint`;
   - `git diff --check`.

Esito Fase 7 pubblicazione (2026-05-09):

1. PR #48 `chore: release latest dependency update` mergeata su `main`;
2. deployment production Vercel verificato `READY` su
   `https://pratix.vercel.app`;
3. smoke pubblico post-deploy completato sulle superfici pubbliche principali;
4. Browser Use autenticato eseguito con fixture controllata su produzione dopo
   la correzione successiva:
   - apertura e navigazione delle route principali autenticate;
   - `/fatture/nuova` senza errore React;
   - generazione fattura da attività selezionate;
   - dettaglio fattura con controlli PDF/XML e rendiconti Excel;
   - verifica mobile sulle superfici operative principali;
   - nessun errore console inatteso;
5. PR #49 `fix: restore invoice server functions` mergeata su `main` per
   correggere la regressione emersa durante lo smoke autenticato;
6. release PATCH successiva `0.12.6` pubblicata con la correzione fatture;
7. deployment production Vercel finale verificato `READY`, deployment
   `dpl_Bb5mxP1ctFEeZN1a22Aj7a8fbUtr`;
8. fixture Supabase temporanea rimossa dopo la verifica;
9. branch locali dedicati assenti e riferimenti remoti stale potati.

Stato finale: il piano update latest dipendenze e toolchain è chiuso. Non
restano attività tecniche bloccanti nel perimetro dell'update.

## Rischi principali

| Rischio                          | Impatto                                | Mitigazione                                       |
| -------------------------------- | -------------------------------------- | ------------------------------------------------- |
| Node 26 diverso da Vercel `24.x` | build locale verde ma production rotta | verificare anche Node 24                          |
| Vite 8 + TanStack Start/Nitro    | build o SSR rotti                      | aggiornare toolchain in blocco isolato            |
| TypeScript 6                     | errori di typing diffusi               | fix mirati, niente indebolimento di `strict`      |
| ESLint 10                        | nuove regole o config incompatibile    | aggiornare `eslint.config.js` solo dove richiesto |
| Zod 4                            | validazioni form/server incompatibili  | testare import, fatture e server functions        |
| React Day Picker 10              | selettori data rotti                   | smoke su date/periodi                             |
| Recharts 3                       | dashboard/grafici rotti                | smoke dashboard e responsive                      |
| Lucide 1                         | icone rinominate o rimosse             | build e controllo UI                              |

## Domande già risolte

1. **Scope**: latest assoluto, inclusi major potenzialmente breaking.
2. **Piano in repo**: sì, questo documento è il piano operativo.
3. **Node**: Node 26 resta utile come latest locale, ma la readiness Pratix
   richiede compatibilità con Node 24 finché Vercel non supporta Node 26.

## Prossimo passo operativo

Nessuna attività tecnica bloccante resta nel perimetro dell'update latest.
I prossimi passi sono solo manutentivi: monitorare Vercel dopo traffico reale,
tenere gli update futuri su PR piccole e aprire un piano separato per la
strategia test automatizzati progressiva già tracciata in roadmap.
