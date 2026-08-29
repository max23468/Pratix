# AGENTS.md

## Obiettivo e priorità

Lavora su Pratix con modifiche focalizzate, sicure, testate e facilmente
revisionabili. Non introdurre lavoro collaterale e non sovrascrivere modifiche
altrui.

Seguono, in ordine: istruzioni della sessione, eventuali `AGENTS.md` più vicini
ai file toccati, questo file, documentazione canonica in `docs/`, codice e test
vicini. Decidi autonomamente i dettagli di routine; chiedi solo quando
un'ambiguità cambia materialmente il risultato o prima di azioni distruttive,
difficili da annullare, deploy e release non già autorizzati.

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

Parti dall'esito e riporta in modo proporzionato: file principali, verifiche o
limiti rilevanti, stato di publish/release/deploy, residui Git, rischi e
prossima azione concreta. Se non resta nulla da fare, dichiaralo.

## Code Review Rules

- Segnala problemi concreti con severity, confidence, file e righe.
- Verifica routing TanStack, responsive e temi, token colore, glossario,
  lockfile, input non fidati, segreti e dipendenze.
- Per nuove tabelle verifica RLS e le quattro policy owner-scoped.
- Non limitare la ricerca ai soli problemi gravi; ordina i finding dopo averli
  raccolti.
