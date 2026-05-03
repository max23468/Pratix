# AGENTS.md

## Scopo

Questo file definisce le linee guida operative per agenti, Codex e collaboratori che lavorano su Pratix.

Obiettivo: mantenere modifiche coerenti, sicure, testate e facilmente revisionabili, senza introdurre lavoro collaterale non richiesto.

## Priorità delle istruzioni

1. Istruzioni di sistema/developer ricevute nella sessione corrente.
2. Questo file `AGENTS.md`.
3. Memoria di progetto (`mem://index.md` per gli agenti, `docs/memory/` come mirror leggibile per chi legge il repo).
4. Documentazione di progetto in `docs/` (guide, ADR, glossario).
5. Assunzioni dell'agente.

In caso di conflitto, seguire sempre il livello più alto.

## Cos'è Pratix

**Pratix** è un gestionale per **avvocati freelance** (singolo professionista, non studio associato). Tagline ufficiale: **"Tutto torna."** — sempre col punto, mai dentro la UI autenticata. Nei titoli pagina e nei meta tag usa il separatore `·`: `Dashboard · Pratix`. La forma `Pratix · Tutto torna.` è riservata alla home pubblica.

Stack:

- **Frontend**: React + TanStack Start v1 (Vite 7), routing **file-based** in `src/routes/`, server functions in `src/server/*.functions.ts`.
- **Backend**: Supabase di proprietà del progetto. Database PostgreSQL con RLS sempre attiva, auth email/password, storage non ancora usato.
- **Deploy**: Vercel, con produzione su `https://pratix.vercel.app`.
- **UI**: Tailwind v4 (token in `src/styles.css`, mai hex inline), shadcn/Radix in `src/components/ui`, icone `lucide-react`.
- **Lingua**: italiano, `lang="it"`.

Per dettagli: [`docs/guides/architettura.md`](./docs/guides/architettura.md), [`docs/data-model.md`](./docs/data-model.md), [`BRAND.md`](./BRAND.md).

### Perimetro e non-obiettivi

Pratix deve restare un gestionale leggero per il singolo avvocato freelance.

Una nuova funzionalità ha senso quando rafforza almeno uno di questi assi:

- recupero crediti, committenti, clienti, controparti, pratiche, attività, compensi/onorari, prezzi, rimborsi spese, rendiconti Excel o fatture;
- sicurezza, privacy, esportazione o governo dei dati dell'utente;
- qualità operativa del professionista freelance;
- affidabilità, manutenzione o deploy del SaaS Vercel + Supabase.

Evita o parcheggia in roadmap le proposte che aprono domini non necessari allo scopo attuale. In particolare Pratix **non** è:

- un gestionale per studi associati o team multi-ruolo;
- un CRM generalista;
- una suite contabile completa;
- una piattaforma multi-tenant enterprise;
- un bot Telegram o un servizio VPS-first;
- una dashboard analytics ampia.

Spostamenti strutturali verso questi perimetri richiedono una decisione esplicita e, se diventano permanenti, un ADR.

## Aspettative sul repository

### Package manager

- **Lockfile autoritativo**: `package-lock.json`. Va sempre allineato a `package.json`.
- **Package manager**: usa `npm` (`npm ci`, `npm install`, `npm run …`). Il repo è progettato attorno a npm.
- **Mai committare** lockfile alternativi: solo `package-lock.json`.

### File generati o gestiti automaticamente — NON modificare a mano

Modificare uno di questi file rompe build o tipi:

- `src/routeTree.gen.ts` — generato dal plugin TanStack Router.
- `src/integrations/supabase/types.ts` — generato dallo schema Supabase.
- `.env` — file locale non committato.

### Configurazione build

- `vite.config.ts` contiene la configurazione esplicita TanStack Start + Nitro + Vercel.
- Non aggiungere target Cloudflare/Wrangler o adapter alternativi senza una decisione architetturale esplicita.

### Disciplina di scope

- Mantieni le modifiche focalizzate ed evita refactor, rinominazioni massive o cambi di formattazione non collegati al task.

## Errori comuni da evitare

Pattern che si ripetono e fanno perdere tempo. Evitali a monte:

- **Router**: usa `@tanstack/react-router`, **mai** `react-router-dom`. Niente `<BrowserRouter>`, niente `useNavigate` da react-router.
- **Routing file-based**: niente `src/pages/`, niente `src/routes/_app/`, niente `app/layout.tsx`. Le route sono file piatti in `src/routes/` con naming dot-separated (`settings.profile.tsx` → `/settings/profile`). Il layout root è sempre `src/routes/__root.tsx`.
- **Link interni**: usa `<Link to="/path">` da `@tanstack/react-router`, mai `<a href>` per navigazione interna (rompe SSR e prefetch).
- **Colori**: mai `bg-white`, `text-black`, hex inline o `style={{ color: '#...' }}`. Solo token semantici (`bg-background`, `text-foreground`, `border-border`, `bg-primary`…). Se manca un token, aggiungilo in `src/styles.css`.
- **Logo**: mai SVG inline o `<img src="/logo.svg">`. Solo `<Logo />` da `src/components/brand/logo.tsx`.
- **Tema**: non leggere `localStorage` direttamente per il tema. Usa `useTheme()` da `src/lib/theme-context.tsx`.
- **Versione**: non hardcodare la versione in UI o documenti. Importa `APP_VERSION` da `src/lib/version.ts`.
- **Supabase**: non creare nuovi client lato UI, non importare `@supabase/supabase-js` direttamente nei componenti. Usa `import { supabase } from "@/integrations/supabase/client"`.
- **Tabelle**: ogni nuova tabella user-owned ha `user_id uuid not null`, RLS abilitata, 4 policy basate su `(select auth.uid()) = user_id`. Niente CHECK constraint con `now()` (non immutabile): usa trigger di validazione.

## Server functions vs route API

Due meccanismi diversi, scopi diversi:

- **`createServerFn`** in `src/server/*.functions.ts` — RPC tipato chiamato dal client React. Usa per logica di business, query DB con service role, integrazioni server-side richiamate dalla UI. Il body del file viene strippato dal bundle client.
- **Server routes** in `src/routes/api/**` — endpoint HTTP raw. Usa per webhook esterni, cron, callback OAuth, endpoint pubblici letti da terzi. Per endpoint pubblici di terzi metti in `src/routes/api/public/**` e **valida sempre la firma/HMAC** prima di processare.

Helper "server-only" (accesso DB, secret) vivono in `src/server/*.server.ts` e sono importati solo da `*.functions.ts` o da route API, mai dai componenti.

`process.env.X` va letto **dentro** `.handler()`, non al top-level del modulo.

## Gestione segreti

- Segreti runtime (es. `SUPABASE_SERVICE_ROLE_KEY`, chiavi terze parti) vanno configurati in Vercel Environment Variables o nel provider dedicato, **non** scritti in `.env` né committati.
- Le chiavi pubbliche Supabase (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`) sono pubblicabili per design, ma si gestiscono comunque tramite env Vercel e file locali non tracciati.
- Prima di scrivere codice che usa una chiave, verifica che sia prevista nel piano env e chiedi all'utente di inserirla nel provider corretto se manca.
- Mai stampare segreti in log, errori o risposte chat. Per verificarne la presenza usa `test -n "$VAR"`, mai `echo $VAR`.

## GitHub, Vercel e Supabase

GitHub è la fonte primaria del codice. Vercel builda e pubblica dal repository. Supabase gestisce database, auth, RLS e migrations.

- Non assumere che lo stato locale sia autoritativo: chi lavora in locale dovrebbe `git pull` prima di iniziare e prima di pushare.
- Una push sul branch collegato genera preview/production deployment su Vercel secondo la configurazione del progetto.
- Stato runtime (dati DB, secret, file Storage) **non** vive su GitHub: solo codice, schema e migrations. Vedi [`docs/guides/database.md`](./docs/guides/database.md).

## Prima di intervenire

- Controlla rapidamente lo stato del repo con `git status --short`.
- Se il worktree contiene modifiche non collegate alla richiesta, non mescolarle con il nuovo lavoro. Per interventi non minuscoli crea o usa un branch/worktree dedicato da una base pulita; per interventi piccoli puoi lavorare nello stesso checkout solo se i file toccati non si sovrappongono e lo dichiari nel riepilogo.
- Prima di proporre architetture o refactor, leggi codice, test e file di configurazione pertinenti.
- Per modifiche a routing o pagine, controlla i file vicini in `src/routes` e verifica che il routing non venga rotto.
- Per modifiche al modello dati, leggi prima [`docs/data-model.md`](./docs/data-model.md) e [`supabase/schema.sql`](./supabase/schema.sql).
- Non sovrascrivere o revertire modifiche non tue: ignorale se sono estranee al task, oppure lavora attorno a esse.
- Se la richiesta è ambigua su scope, comportamento atteso, rischio o tradeoff, chiedi chiarimento prima di procedere. Procedi con un'assunzione dichiarata solo per dettagli marginali che non cambiano il risultato sostanziale.

## Lingua e testi del prodotto

- Usa l'italiano come lingua predefinita con il proprietario del progetto.
- La UI del prodotto deve essere scritta in italiano, salvo funzionalità che richiedano esplicitamente un'altra lingua.
- Testi utente, label, messaggi di validazione, stati vuoti, errori, meta tag e documentazione destinata agli utenti finali devono essere in italiano quando vengono creati o modificati.
- Per superfici utente italiane, usa `lang="it"` nell'HTML o aggiorna il valore esistente quando tocchi il root layout.
- Mantieni gli identificatori nel codice in inglese quando questo è più coerente con le convenzioni di librerie e framework esistenti.
- **Tono di voce**: "tu" professionale neutro. No emoji nella UI, no esclamativi multipli, no "Oops". Frasi brevi, stato del sistema. Vedi [`docs/guides/tono-di-voce.md`](./docs/guides/tono-di-voce.md).

### Glossario di prodotto

Vincoli di terminologia (vedi [`docs/glossario.md`](./docs/glossario.md)):

- **Usa**: Committente, Cliente, Controparte, Pratica, Attività, Compenso/Onorario, Prezzi, Rimborso spese, Spese, Fattura, Rendiconto Excel, Professione.
- **Vietato**: Caso, Assistito, Deadline, Costi.
- **Studio** non è più una parola vietata in assoluto, ma Pratix resta per avvocati freelance: non usare "studio" per posizionare il prodotto come gestionale per studi associati o team multi-ruolo.
- **Attività** è ora un termine centrale di prodotto: indica le voci operative e fatturabili dentro una pratica.

## Qualità UI React

- Segui le convenzioni già presenti nel progetto e nei componenti shadcn/Radix in `src/components/ui`.
- Usa `lucide-react` per le icone quando esiste un'icona adatta.
- Mantieni le UI responsive su mobile e desktop, con testi che non escano dai contenitori e controlli che restino utilizzabili.
- Preferisci componenti piccoli, leggibili e coerenti con il design system esistente.
- Non introdurre nuove dipendenze UI o librerie di stato senza motivazione esplicita e impatto chiaro.
- **Solo token semantici per i colori** (`bg-primary`, `text-foreground`, `border-border`…). Mai hex inline o classi tipo `bg-white`. La palette vive in `src/styles.css` (oklch). Vedi [`BRAND.md`](./BRAND.md).
- **Logo**: solo `<Logo>` da `src/components/brand/logo.tsx`. Mai SVG inline.
- Per modifiche UI sostanziali, verifica quando praticabile la resa desktop/mobile e chiaro/scuro. Se non puoi farlo, dichiaralo con il rischio residuo.

## Sicurezza e dati

- Non committare segreti, token, credenziali, file `.env` reali o dati personali.
- Le chiavi pubbliche (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`) sono per design pubbliche e già committate.
- I segreti runtime (es. `SUPABASE_SERVICE_ROLE_KEY`) vivono in Vercel/Supabase, mai nel repo.
- Valida e tratta con cautela input utente, form, link esterni, HTML generato e contenuto renderizzato dinamicamente.
- Evita leak di dati sensibili in log, errori, trace, screenshot o fixture. In particolare: niente nomi clienti reali, importi reali di fatture, dati personali in screenshot di issue o PR.
- Per modifiche alle dipendenze, valuta il rischio di supply chain e usa `npm audit --audit-level=moderate`.
- **RLS sempre attiva**: ogni nuova tabella user-owned ha 4 policy (select/insert/update/delete) basate su `(select auth.uid()) = user_id`. Mai disabilitare RLS.

## Setup e verifica

- Installa le dipendenze con `npm ci`.
- Usa `npm run build` come comando principale di validazione.
- Usa `npm run lint` quando le modifiche toccano TypeScript, React, routing, componenti UI condivisi o configurazione correlata.
- Usa `npm run format:changed:check` quando tocchi file formattabili; se fallisce, esegui `npm run format:changed` e ricommitta.
- Usa `npm audit --audit-level=moderate` dopo modifiche alle dipendenze.
- Usa `npm run ci:local` come gate completo quando la modifica è abbastanza ampia da giustificarlo.
- Prima del push usa `npm run prepush:guard` oppure lascia lavorare `.githooks/pre-push`: esegue solo i controlli necessari al diff e li mette in cache per la stessa fingerprint, evitando di ripetere format/build/lint/audit già validati dallo stesso guard.
- Se hai appena eseguito controlli equivalenti manualmente sullo stesso diff, puoi usare `PRATIX_SKIP_PREPUSH=1 git push`, ma solo dichiarando il motivo nel riepilogo operativo.
- Per modifiche solo documentali, non serve inventare test applicativi: rileggi il documento e verifica la coerenza delle istruzioni.
- Non inventare risultati di test o comandi non eseguiti. Se un controllo non può essere eseguito, dichiaralo esplicitamente con motivo e rischio residuo.
- Nelle risposte finali evita footer rituali sui test. Riporta verifiche solo quando sono utili: comando eseguito, fallimento, controllo non eseguibile, limite noto o rischio residuo.

## Documentazione, memoria, glossario

Pratix tiene molta documentazione "viva": va aggiornata insieme alle modifiche.

### Cosa aggiornare e quando

- **`ROADMAP.md`** — _ogni_ decisione di prodotto, brand o tecnica condivisa in chat deve confluire qui. Aggiorna lo stato (✅ 🟡 ⬜ 💤) quando una voce cambia.
- **`CHANGELOG.md`** — voci sotto `[Non rilasciato]` per ogni modifica utente-visibile o operativamente rilevante. Categorie versionate: `Novità` (in evidenza), `Correzioni` (bugfix/sicurezza), `Sotto il cofano` (refactor/asset/migrazioni invisibili). Usa `Non versionato` per piani, ADR, guide, regole agenti e documentazione interna che vengono pubblicati nel repo ma non cambiano app, runtime, contenuti esposti o supporto a una versione.
- **`docs/decisions/`** — un nuovo ADR per ogni decisione "per sempre" (architettura, brand strutturale, vincoli di processo). Numerazione progressiva.
- **`docs/guides/`** — guide operative per aree tematiche (architettura, database, fatturazione, tema, tono di voce, deploy, migrations, versioning).
- **`docs/data-model.md`** + **`supabase/schema.sql`** — quando cambia il modello dati.
- **`BRAND.md`** — quando cambia un elemento di brand (palette, tipografia, logo, tono).
- **`docs/glossario.md`** — quando si introduce o vieta un termine.

#### Mappa rapida: tipo di modifica → file da toccare

| Tipo di modifica                                       | File da aggiornare (oltre al codice)                                                                                |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| Nuova feature utente-visibile                          | `CHANGELOG.md` (Novità), `ROADMAP.md`, bump MINOR in `version.ts` al rilascio                                       |
| Bugfix / correzione UI                                 | `CHANGELOG.md` (Correzioni), bump PATCH al rilascio                                                                 |
| Refactor o asset interno                               | `CHANGELOG.md` (Sotto il cofano), bump PATCH al rilascio se entra in app/runtime                                    |
| Decisione "per sempre" (architettura, brand, processo) | nuovo ADR in `docs/decisions/` + `ROADMAP.md` + memoria + `CHANGELOG.md` (Non versionato se resta solo documentale) |
| Cambio modello dati (tabelle, RLS, trigger)            | migrazione SQL + `docs/data-model.md` + `supabase/schema.sql` + `CHANGELOG.md`                                      |
| Cambio brand (palette, tipografia, logo, tono)         | `BRAND.md` + `src/styles.css` + memoria + `CHANGELOG.md`                                                            |
| Nuovo, modificato o vietato termine di prodotto        | `docs/glossario.md` + memoria + (se cambia label UI) `CHANGELOG.md`                                                 |
| Nuova guida operativa                                  | `docs/guides/<nome>.md` + link da `AGENTS.md` o `README.md` se rilevante                                            |
| Cambio regola di processo per agenti                   | `mem://` + mirror in `docs/memory/` + (se utile) `AGENTS.md`                                                        |

### Memoria di progetto

- Fonte di verità: `mem://` (visibile agli agenti).
- Mirror leggibile in `docs/memory/` (per umani che leggono il repo).
- Quando una regola cambia: aggiorna `mem://` **e** il mirror corrispondente.

### Versioning e rilascio

Pratix usa **SemVer convenzionale** adattato a SaaS hostato (vedi [`docs/decisions/0008-versioning-e-changelog.md`](./docs/decisions/0008-versioning-e-changelog.md)).

- **Single source of truth**: `src/lib/version.ts` (`APP_VERSION` + `BUILD_DATE`).
- **Bump**: MAJOR = breaking utente, MINOR = nuova feature, PATCH = bugfix/UI/contenuti/runtime/supporto.
- **Nessuna release**: quarta categoria obbligatoria per bozze, note locali, test-only, commenti, formattazione isolata, piani, ADR, regole agenti e docs interne non operative; non produce una nuova versione. Se viene annotata nel changelog, usa `### Non versionato`.
- **Rilasciare** = eseguire `npm run release` (oppure `npm run release -- --bump patch|minor|major`), verificare il diff generato e promuovere il deployment Vercel. Il comando aggiorna `src/lib/version.ts`, rinomina `[Non rilasciato]` → `[X.Y.Z] — YYYY-MM-DD`, crea il nuovo blocco `[Non rilasciato]` e aggiorna i link del changelog.
- **Pubblicare / tutto pubblicato** = merge su `main` + deployment production Vercel completato e verificato + branch dedicato chiuso/eliminato se esiste. Una PR aperta, un push sul branch o una preview Vercel non bastano. Quando il proprietario chiede "pubblica", "pubblica tutto" o "è tutto pubblicato?", completa questi passaggi oppure dichiara esattamente cosa manca.
- **Pubblicare non significa sempre rilasciare**: se il diff contiene solo piani, ADR, guide interne, PDF di pianificazione o regole di processo non esposte nell'app, pubblica su GitHub/main senza bump SemVer e senza modificare `src/lib/version.ts`.
- Per modifiche solo documentali non esposte all'app (`AGENTS.md`, `README.md`, `docs/**` interne), il deploy Vercel automatico non deve bloccare la chiusura: basta verificare PR/check pertinenti. Per documenti o release esposti nella UI (`CHANGELOG.md`, `src/lib/version.ts`, testi pubblici, landing, privacy/termini), verifica almeno che il deployment production sia `READY` e che la pagina interessata risponda.
- **Regola obbligatoria per ogni cambio progetto**: ogni volta che modifichi codice, documentazione, configurazione, schema DB, brand, processo o deploy, valuta sempre l'impatto sul versioning prima di chiudere il lavoro.
- **Gate di chiusura fase**: prima di dichiarare conclusa una modifica, fase, migrazione, cutover o lavoro già pubblicato/deployato, controlla `CHANGELOG.md`. Se il blocco `[Non rilasciato]` contiene solo `Non versionato`, non eseguire release e non bumpare. Se contiene `Novità`, `Correzioni` o `Sotto il cofano`, non chiudere senza `npm run release` oppure senza dichiarare esplicitamente che il rilascio resta il prossimo step operativo.
- **Default post-migrazione**: per migrazioni, cutover, correzioni infra o bonifiche sotto il cofano completate senza nuove feature utente, usa PATCH salvo istruzione diversa o impatto utente maggiore.
- Procedura completa: [`docs/guides/versioning-e-release.md`](./docs/guides/versioning-e-release.md).

## Commit e PR

- Quando crei commit, mantienili atomici e usa **Conventional Commit** coerenti con l'impatto reale (`feat:`, `fix:`, `docs:`, `test:`, `chore:`, `refactor:`, `style:`).
- Non aggiungere workflow GitHub Actions, policy di deploy o flussi di release non presenti senza richiesta esplicita. Il rilascio operativo avviene tramite Vercel.
- Nelle PR usa il template in `.github/PULL_REQUEST_TEMPLATE.md`. Riporta in modo concreto cosa è cambiato, dove, eventuali rischi residui e verifiche rilevanti. Evita footer rituali se non aggiungono valore.

## Linee guida per la review

- Controlla che il routing in `src/routes` non sia rotto.
- Controlla che le modifiche UI restino responsive su mobile e desktop, in **entrambi i temi** (chiaro e scuro).
- Controlla che gli aggiornamenti alle dipendenze non disallineino `package.json` e `package-lock.json`.
- Verifica che i nuovi colori usino token semantici, non hex inline.
- Verifica che il glossario di prodotto sia rispettato (Committente/Cliente/Controparte/Pratica/Attività/Compenso-Onorario/Prezzi/Rimborso spese/Fattura/Rendiconto Excel; no Caso/Assistito/Deadline/Costi).
- Verifica che le nuove tabelle abbiano RLS attiva e 4 policy per `user_id` con `(select auth.uid())`.
- Segnala problemi di sicurezza nella gestione degli input utente, HTML generato, link, form e modifiche alle dipendenze.

## Definizione di completamento

Una modifica è pronta se:

- risolve la richiesta senza regressioni evidenti;
- mantiene coerenza con architettura, stack, glossario e convenzioni esistenti;
- non rompe routing, build o UI responsive nelle aree toccate;
- rispetta RLS e principi di sicurezza se ha toccato il DB;
- include verifiche eseguite o limiti noti quando rilevanti;
- aggiorna `ROADMAP.md`, `CHANGELOG.md`, ADR, `docs/` e memoria solo quando serve davvero;
- non lascia file temporanei, dati sensibili o modifiche non correlate.
