# AGENTS.md

## Obiettivo e priorità

Lavora su Pratix con modifiche focalizzate, sicure, testate e facilmente
revisionabili. Non introdurre lavoro collaterale e non sovrascrivere modifiche
altrui.

Seguono, in ordine: istruzioni della sessione, eventuali `AGENTS.md` più vicini
ai file toccati, questo file, documentazione canonica in `docs/`, codice e test
vicini. Le azioni distruttive o difficili da annullare e i deploy/release non
già autorizzati richiedono consenso esplicito.

## Prodotto

Pratix è un gestionale leggero per avvocati freelance, non per studi associati
o team multi-ruolo. Rafforza recupero crediti, committenti, clienti,
controparti, pratiche, attività, compensi/onorari, prezzi, rimborsi spese,
fatture, rendiconti Excel, sicurezza dei dati e qualità operativa.

Non estenderlo senza decisione esplicita verso CRM generalista, suite contabile
completa, piattaforma enterprise, bot Telegram, VPS-first o analytics ampia. Un
cambio strutturale di perimetro richiede un ADR.

La tagline è **"Tutto torna."**, sempre col punto e mai nella UI autenticata.
Nei title e meta usa `·` (`Dashboard · Pratix`); `Pratix · Tutto torna.` è
riservato alla home pubblica.

Riferimenti: [`docs/CONTEXT.md`](./docs/CONTEXT.md),
[`docs/ROADMAP.md`](./docs/ROADMAP.md), [`BRAND.md`](./BRAND.md) e
[`docs/glossario.md`](./docs/glossario.md).

## Stack e confini tecnici

- Usa `npm`; `package-lock.json` è l'unico lockfile autoritativo.
- Frontend: React, TanStack Start v1, Vite 7, Tailwind v4, shadcn/Radix.
- Routing file-based in `src/routes/`: file piatti dot-separated, root
  `src/routes/__root.tsx`, import da `@tanstack/react-router`.
- Backend: Supabase PostgreSQL con RLS, Auth passwordless, passkey dietro
  feature flag e Storage privato.
- Deploy: Vercel, produzione `https://pratix.vercel.app`. Non aggiungere target
  Cloudflare/Wrangler o adapter alternativi senza decisione architetturale.
- Non modificare a mano `src/routeTree.gen.ts`,
  `src/integrations/supabase/types.ts` o `.env`.

### Pattern obbligatori

- Link interni con `<Link>` di TanStack Router, non `<a href>`.
- Colori solo tramite token semantici; niente hex inline, `bg-white` o
  `text-black`.
- Logo solo con `<Logo />` da `src/components/brand/logo.tsx`.
- Tema tramite `useTheme()` da `src/lib/theme-context.tsx`, non leggendo
  `localStorage`.
- Versione tramite `APP_VERSION` da `src/lib/version.ts`, mai hardcoded.
- Client Supabase condiviso da `@/integrations/supabase/client`, senza crearne
  altri nei componenti.
- `createServerFn` in `src/server/*.functions.ts` per RPC tipizzate dalla UI;
  route in `src/routes/api/**` per webhook, cron, callback ed endpoint HTTP.
- Helper con segreti in `src/server/*.server.ts`, importati solo da server
  function o route API. Leggi `process.env` dentro `.handler()`.
- Endpoint pubblici di terzi sotto `src/routes/api/public/**`, con firma/HMAC
  validata prima di elaborare la richiesta.

Riferimenti: [`docs/guides/architettura.md`](./docs/guides/architettura.md) e
[`docs/guides/database.md`](./docs/guides/database.md).

## Sicurezza e dati

- Non committare o mostrare segreti, credenziali, dati personali o file `.env`
  reali. I segreti runtime vivono nei provider.
- Valida input utente, form, link esterni, HTML e contenuti dinamici.
- Ogni nuova tabella user-owned ha `user_id uuid not null`, RLS attiva e policy
  select/insert/update/delete basate su `(select auth.uid()) = user_id`.
- Non usare `now()` in un CHECK constraint; usa un trigger di validazione.
- Dopo cambi alle dipendenze esegui `npm audit --audit-level=moderate`.
- Per provider, API, prezzi, limiti, policy e fonti fiscali o normative
  variabili consulta fonti ufficiali correnti, distinguendo fatti, inferenze e
  scelte interne.

## UI e contenuti

UI e testi utente sono in italiano (`lang="it"`), con "tu" professionale,
frasi brevi e stato del sistema. Niente emoji, "Oops" o esclamativi multipli.
Mantieni identificatori tecnici in inglese quando coerente col codice.

Usa il glossario canonico: Committente, Cliente, Controparte, Pratica,
Attività, Compenso/Onorario, Prezzi, Rimborso spese, Spese, Fattura,
Rendiconto Excel, Professione. Non usare Caso, Assistito, Deadline o Costi.

Mantieni le UI responsive, accessibili e coerenti in tema chiaro e scuro. Usa
componenti esistenti e icone `lucide-react`; non aggiungere dipendenze UI o
stato senza una necessità concreta.

Riferimenti: [`docs/guides/tono-di-voce.md`](./docs/guides/tono-di-voce.md),
[`docs/glossario.md`](./docs/glossario.md) e [`BRAND.md`](./BRAND.md).

## Flusso di lavoro

Evita di creare un numero eccessivo di file di test. Crea un nuovo file di test
solo se richiesto dalle convenzioni della repository o se nessun file esistente
è una collocazione adatta. Evita pulizie non pertinenti e complessità non
necessaria. Riusa le utility esistenti adatte allo scopo. Leggi le istruzioni
pertinenti della repository ed esamina codice, test, documentazione e CI vicini
all'area interessata. Segui le convenzioni consolidate. L'obiettivo è ottenere
codice pulito e pronto per essere integrato.

Prima di intervenire:

- controlla `git status --short` e preserva modifiche non collegate;
- leggi codice, test e configurazione pertinenti;
- per routing, UI o modello dati leggi anche i riferimenti canonici vicini;
- per lavori non banali usa un branch `codex/<tema>` e una PR verso `main`.

Durante il lavoro aggiorna l'utente solo all'avvio, su scoperte importanti o
cambi di direzione. Preferisci il minimo diff che risolve la causa e riusa
pattern esistenti.

Aggiorna la documentazione solo quando cambia davvero: `CHANGELOG.md` per
modifiche visibili o operative; `docs/ROADMAP.md` per direzione e priorità; ADR
per decisioni durevoli; modello dati e schema insieme alle migrazioni; brand e
glossario con le rispettive fonti canoniche. Non creare documenti duplicati.

## Verifica

Calibra la verifica sul rischio del diff e completa i gate applicabili. Riusa
i test esistenti; aggiungine solo per un comportamento o rischio concreto, non
per replicare modifiche banali. Dopo un esito verde ripeti o amplia i controlli
solo per nuove modifiche, errori o dubbi irrisolti. Verifica il diff effettivo,
senza trattare il messaggio di successo di uno strumento come prova sufficiente.

Scegli gate proporzionati al diff:

- analisi o docs interne: rilettura, coerenza link, `git diff --check` e
  `npm run format:changed:check` se utile;
- TypeScript, React, routing o configurazione: test mirati, `npm run lint` e
  `npm run build`;
- dipendenze: controlli precedenti più `npm audit --audit-level=moderate`;
- UI ampia, componenti condivisi, routing o flussi autenticati critici:
  `npm run prepush:guard` e smoke pertinenti (`smoke:a11y`,
  `smoke:a11y:auth` o `smoke:a11y:quick`);
- changelog: `npm run changelog:check`.

Non inventare risultati. Se un controllo rilevante non è eseguibile, dichiara
motivo e rischio residuo.

## Significato di `Pubblica`

Quando il proprietario, riferendosi alla repository o alla modifica corrente,
dice `Pubblica` o chiede in modo affermativo e inequivocabile di pubblicare,
autorizza l'intero ciclo tecnico applicabile. Domande, ipotesi, pianificazioni e
negazioni non costituiscono autorizzazione. L'agente non si ferma a stati
intermedi e completa tutti i passaggi applicabili: preparazione e verifiche,
branch e commit, versione e changelog quando richiesti, push, PR, soli gate
bloccanti, merge, tag e GitHub Release quando previsti, deploy o promozione
tecnica e verifica live. La sequenza concreta, in particolare tra versionamento,
merge, deploy e release, è quella definita dalla policy della repository.

La pulizia finale rimuove soltanto branch e worktree temporanei creati nel ciclo
corrente e già assorbiti; controlla stash e altri residui senza alterare elementi
preesistenti o estranei alla pubblicazione. Se un passaggio non è applicabile, lo
dichiara e prosegue con gli altri. La richiesta affermativa di pubblicazione
vale come autorizzazione a PR, merge, deploy tecnico e release previsti dal
ciclo, senza una seconda conferma. Non autorizza pubblicazione di temi Shopify
live, submission Shopify App Store, billing o nuove attivazioni produttive,
TestFlight o App Store, invii Aruba, email o scansioni reali, né aggiornamenti
Notion: queste azioni richiedono una richiesta esplicita separata. Una richiesta
riferita soltanto a una di queste azioni non avvia la pubblicazione della
repository. Non dichiarare `pubblicato` finché il ciclo applicabile e la
rilettura finale di PR, check, deploy, release e stato Git non sono completi.

## PR, pubblicazione e release

Usa Conventional Commits e un titolo PR esplicito, non il nome del branch.
Dopo il merge usa, quando applicabile:

```sh
npm run publish:finish -- --pr <numero-pr> --routes /,/novita
```

Valuta sempre il versioning. Docs interne, piani, ADR e regole agenti sono
`Non versionato`: nessun bump, tag o GitHub Release. Se `[Non rilasciato]`
contiene `Novità`, `Correzioni` o `Sotto il cofano`, esegui la release
appropriata o dichiara che resta da fare. Ogni release prodotto include tag
`vX.Y.Z`, GitHub Release e deployment production verificato.

Procedure canoniche:
[`docs/guides/versioning-e-release.md`](./docs/guides/versioning-e-release.md)
e [`docs/guides/deploy.md`](./docs/guides/deploy.md).

## Chiusura

Scrivi in italiano semplice, con esito per primo e paragrafi brevi. Usa elenchi
solo quando aiutano; evita formule ricorrenti, gergo superfluo e aggiornamenti
che ripetono lo stesso stato. Riporta prove, limiti e prossima azione reale.

Completa l'esito richiesto: analisi, modifica locale o pubblicazione. Distingui
passaggi completati, non richiesti, non applicabili e bloccati; non dichiarare
completo ciò che resta bloccato o non verificato. Applica i requisiti di commit
previsti per l'implementazione e pulisci soltanto risorse proprie e assorbite,
preservando modifiche e worktree altrui.

Riporta file principali, stato di publish/release/deploy e residui Git quando
pertinenti. Se non resta nulla da fare, dichiaralo.

## Code Review Rules

- Segnala problemi concreti con severity, confidence, file e righe.
- Verifica routing TanStack, responsive e temi, token colore, glossario,
  lockfile, input non fidati, segreti e dipendenze.
- Per nuove tabelle verifica RLS e le quattro policy owner-scoped.
- Non limitare la ricerca ai soli problemi gravi; ordina i finding dopo averli
  raccolti.

## Autonomia

Interpreta le richieste operative come incarichi da completare, usando intento
e contesto della sessione. Risolvi autonomamente naming, formattazione, default
e dettagli ordinari con assunzioni ragionevoli. Prima di chiedere un chiarimento,
verifica le fonti disponibili; chiedi solo se resta una decisione che cambia
materialmente il risultato.

Prima di una conferma necessaria, completa il lavoro indipendente già autorizzato
e prepara un risultato concreto da valutare. Sospendi soltanto il passaggio che
dipende dalla decisione mancante. Non richiedere consensi già concessi per la
stessa azione e lo stesso perimetro, salvo un checkpoint esplicito del progetto.
Conserva i confini di pubblicazione, dati e operazioni esterne definiti qui;
un ordine esplicito di attesa o arresto interrompe il lavoro interessato.
Il tempo trascorso non costituisce una risposta o un'autorizzazione.

Integra correzioni e nuovi vincoli durante il lavoro; rispondi alle domande
laterali senza perdere l'obiettivo, salvo annullamento o cambio di scope esplicito.

## Skill e delega

Le istruzioni esplicite dell'utente prevalgono sulle linee guida delle Skill,
nel rispetto delle istruzioni di sistema e sviluppatore. Verifica pertinenza,
gerarchia e conflitti di AGENTS, override e Skill prima di dedurne un blocco;
non trasformare raccomandazioni generiche in nuovi gate.

Se una Skill causa una pausa, una richiesta di permesso o lavoro incompleto,
cita e collega il preciso `SKILL.md`, riporta l'istruzione rilevante e distingui
il requisito esplicito dalla tua interpretazione.

Quando la sessione e le regole del progetto consentono subagent, delega solo
filoni consistenti e indipendenti, con ownership disgiunta, risultato atteso e
verifiche espliciti. Il coordinatore integra; niente delega per microtask o
semplice ricontrollo. Scrivi messaggi leggibili anche tra agenti.

Esempio e fonti: [preparare un incarico](docs/TOOLCHAIN.md#preparare-un-incarico).
