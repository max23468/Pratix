# Uscita completa da Lovable

Questa guida definisce il piano per poter chiudere Lovable al 100% senza
conseguenze operative su Pratix.

## Obiettivo

Portare Pratix su una filiera interamente controllata fuori da Lovable:

- **Codice**: GitHub come fonte primaria (`https://github.com/max23468/Pratix.git`).
- **Sviluppo**: Codex come ambiente principale, con branch e PR.
- **Backend**: Supabase di proprietà del progetto, non Lovable Cloud.
- **Pubblicazione**: Vercel, con dominio gratuito `*.vercel.app`.
- **Lovable**: solo sorgente temporanea da svuotare, poi disattivare.

DuckDNS non è un vincolo di progetto. Era stato considerato solo come modo per
avere un dominio gratuito; Vercel risolve lo stesso bisogno con un dominio
`*.vercel.app` e senza introdurre VPS, reverse proxy o aggiornamento DNS
dinamico.

## Stato di partenza

- Il repository GitHub esiste già ed è il ponte operativo principale.
- Il backend attuale è Lovable Cloud, basato su Supabase gestito da Lovable.
- In Lovable Cloud esiste un solo utente.
- Il repo contiene già `supabase/schema.sql` come baseline leggibile.
- Il runtime attuale è TanStack Start su Vite, con configurazione Cloudflare
  derivata dal template Lovable.

## Inventario ricevuto da Lovable

Risultato dell'inventario Lovable:

- Backend attuale: Lovable Cloud managed, basato su Supabase gestito da Lovable.
- Regione backend: EU.
- Utenti: 1 utente auth.
- Dati `public`: 1 riga in `profiles`; `clients`, `cases`,
  `case_deadlines`, `case_status_history`, `expenses`, `invoices` e
  `invoice_lines` sono vuote.
- Tabelle `public`: `profiles`, `clients`, `cases`, `case_deadlines`,
  `case_status_history`, `expenses`, `invoices`, `invoice_lines`.
- Viste: nessuna.
- Enum: `case_matter`, `case_status`, `client_kind`, `expense_category`,
  `fee_type`, `invoice_line_kind`, `invoice_status`, `tax_regime`.
- Funzioni SQL: `handle_new_user()`, `log_case_status_change()`,
  `set_updated_at()`.
- Storage buckets: nessuno.
- Edge Functions deployate: nessuna.
- API routes pubbliche, webhook, cron: nessuno.
- Server functions: solo `src/server/invoices.functions.ts`.
- Migrations applicate: 3, tutte presenti in `supabase/migrations/`.
- `supabase/schema.sql`: sufficiente come baseline, con verifica manuale dei
  trigger dopo l'apply sul nuovo Supabase.
- Trigger `on_auth_user_created`: presente nelle migrations, aggiunto anche a
  `supabase/schema.sql` per rendere la baseline autosufficiente fuori da
  Lovable.

L'export del profilo utente contiene dati personali e non va mai committato.
Va trattato come artefatto locale temporaneo, usato solo per importare la riga
`profiles` nel nuovo backend.

## Architettura target

```mermaid
flowchart LR
  dev["Codex / locale"] --> git["GitHub"]
  git --> vercel["Vercel"]
  vercel --> app["Pratix TanStack Start"]
  app --> supa["Supabase del progetto"]
```

## Tool target

Questa migrazione usa pochi strumenti, con responsabilità separate:

| Tool         | Ruolo                                                                       |
| ------------ | --------------------------------------------------------------------------- |
| GitHub       | Fonte del codice, branch, PR, storico modifiche                             |
| Codex        | Sviluppo, refactor, verifiche, documentazione                               |
| Vercel       | Hosting, preview deployment, produzione su `*.vercel.app`, env vars runtime |
| Supabase     | Database PostgreSQL, Auth, Storage futuro, RLS, migrations e types          |
| Supabase CLI | Applicazione migrations, dump/restore, type generation, verifica schema     |

Vercel e Supabase sono complementari: Vercel esegue e pubblica l'app, Supabase
gestisce dati, login e isolamento per utente. Evitiamo alternative più pesanti
come VPS, reverse proxy o auth custom perché Pratix usa già il modello Supabase
(`auth.uid()`, RLS e client Supabase).

### Scelta backend

Percorso consigliato:

1. Creare un nuovo progetto Supabase sotto un account controllato dal
   proprietario di Pratix.
2. Applicare schema e migrations dal repo.
3. Migrare l'unico utente e i dati associati.
4. Rigenerare types e configurazione client.
5. Puntare l'app al nuovo progetto Supabase.

Supabase self-hosted resta possibile, ma non è il primo passo consigliato:
aggiunge gestione di Postgres, Auth, Storage, backup, aggiornamenti e
sicurezza. Per uscire da Lovable senza aumentare troppo il rischio, è meglio
separare prima Lovable dal backend usando Supabase gestito da noi.

### Scelta pubblicazione

Percorso consigliato:

1. Collegare il repository GitHub a Vercel.
2. Configurare Pratix come progetto TanStack Start su Vercel.
3. Usare il dominio gratuito `*.vercel.app` per produzione e preview.
4. Inserire le variabili Supabase negli Environment Variables di Vercel.
5. Tenere un dominio proprietario come scelta futura, non necessaria per uscire
   da Lovable.

## Fase 1 — Inventario Lovable

Prima di toccare produzione, chiedere a Lovable:

1. Questo progetto usa Lovable Cloud managed backend o un Supabase project di
   mia proprietà?
2. Posso esportare schema, dati, utenti auth, edge functions, storage buckets e
   secrets inventory?
3. Quali dati non sono esportabili direttamente da Lovable Cloud?
4. Posso ottenere l'UUID dell'utente esistente e l'elenco di tutte le tabelle
   con righe associate a quell'utente?
5. Le password hash dell'utente auth sono esportabili oppure devo forzare un
   reset password nel nuovo backend?
6. Ci sono edge functions, webhook, cron o secrets configurati fuori dal repo?
7. Dopo la migrazione posso disconnettere GitHub e chiudere Lovable senza
   perdere storico o file?

### Prompt pronto per Lovable

```text
Voglio migrare Pratix fuori da Lovable al 100%.

Target: codice su GitHub, hosting su Vercel, backend su un progetto Supabase di mia proprietà. Non voglio più dipendere da Lovable per runtime, database, auth, secrets, publish o funzioni.

Mi serve un inventario completo e pratico dello stato attuale:

1. Conferma se il backend attuale è Lovable Cloud managed oppure un Supabase project di mia proprietà.
2. Elenca tutte le tabelle, viste, funzioni SQL, trigger, enum, indici, policy RLS e storage buckets usati dal progetto.
3. Dimmi se `supabase/schema.sql` nel repo è sufficiente per ricreare lo schema in un nuovo Supabase oppure se mancano oggetti.
4. Elenca tutte le migrations applicate e dimmi se quelle presenti in `supabase/migrations/` sono complete.
5. Esporta o indicami come esportare i dati `public` dell'unico utente esistente, senza includere dati sensibili non necessari.
6. Forniscimi l'UUID dell'utente esistente e l'elenco di tutte le tabelle con righe collegate a quell'utente.
7. Dimmi se posso esportare l'utente auth preservando UUID e password hash. Se no, conferma che la strategia corretta è creare un nuovo utente nel nuovo Supabase, forzare reset password e rimappare i `user_id`.
8. Elenca tutti i secrets configurati oggi, solo come nomi e scopo, senza mostrare valori.
9. Elenca eventuali Edge Functions, webhook, cron, API routes o integrazioni che dipendono da Lovable Cloud o da secrets Lovable.
10. Elenca quali variabili ambiente dovrò configurare su Vercel e quali invece servono solo in Supabase.
11. Segnala eventuali riferimenti a Lovable nel codice o nella configurazione che dovranno essere rimossi prima del cutover.
12. Dimmi la procedura consigliata per disconnettere o chiudere Lovable dopo che Pratix sarà funzionante su Vercel + Supabase, senza perdere accesso al repo GitHub.

Output desiderato: checklist ordinata per migrazione, con eventuali comandi o file da controllare.
```

Output atteso:

- schema DB esportato;
- dump dati `public` senza committarlo;
- inventario auth utente;
- inventario secrets;
- inventario storage;
- elenco funzioni/server routes esterne;
- conferma del percorso di disattivazione Lovable.

## Fase 2 — Preparazione nuovo backend

1. Creare il progetto Supabase di proprietà.
2. Configurare Auth email/password.
3. Applicare `supabase/schema.sql`.
4. Applicare eventuali migrations in `supabase/migrations/` non incluse nella
   baseline.
5. Verificare RLS su tutte le tabelle user-owned.
6. Configurare redirect auth:
   - URL locale;
   - URL production `*.vercel.app`;
   - URL preview Vercel, se usato per test auth.
7. Inserire secrets nel nuovo provider, non nel repo.
8. Rigenerare `src/integrations/supabase/types.ts` dal nuovo progetto.

Per l'unico utente esistente ci sono due opzioni:

- **Opzione semplice**: creare un nuovo utente nel nuovo Supabase, forzare reset
  password, poi rimappare tutti i `user_id` esportati dal vecchio UUID al nuovo
  UUID.
- **Opzione conservativa**: preservare l'UUID auth originale, solo se Lovable
  fornisce un export auth compatibile e testabile.

Con un solo utente, l'opzione semplice è di solito più sicura e più veloce.

Nota da verificare prima dell'import definitivo: Lovable indica che l'Admin API
Supabase può creare l'utente preservando l'UUID originale. Prima di basare la
migrazione su questo comportamento, testarlo su un progetto Supabase appena
creato. Se la creazione con UUID esplicito non è supportata o fallisce, usare il
nuovo UUID generato da Supabase e rimappare `profiles.id` più tutti i futuri
`user_id` importati.

Script locale preparato:

```bash
SUPABASE_URL="https://<project-ref>.supabase.co" \
SUPABASE_SERVICE_ROLE_KEY="<service-role-key>" \
PRATIX_MIGRATION_USER_ID="<uuid-da-preservare>" \
PRATIX_MIGRATION_USER_EMAIL="<email-utente>" \
PRATIX_MIGRATION_TEMP_PASSWORD="<password-temporanea>" \
PRATIX_MIGRATION_FULL_NAME="<nome-opzionale>" \
node scripts/recreate-supabase-user.mjs
```

Il link di recovery stampato dallo script contiene un token: usarlo localmente
per impostare la password definitiva e non incollarlo in chat, issue, log o
documenti.

## Fase 3 — Preparazione runtime fuori Lovable

1. Rimuovere la dipendenza operativa da `@lovable.dev/vite-tanstack-config`.
2. Rendere esplicita la configurazione Vite/TanStack per Vercel.
3. Aggiungere la configurazione Nitro richiesta da TanStack Start su Vercel.
4. Spostare la gestione env su Vercel Environment Variables e file locali non
   committati.
5. Validare:
   - `npm ci`;
   - `npm run build`;
   - `npm run lint`;
   - login;
   - CRUD principali;
   - generazione PDF/XML fattura;
   - reset password.

## Fase 4 — Deploy su Vercel

1. Creare o collegare il progetto Vercel dal repository GitHub.
2. Impostare framework/build coerenti con TanStack Start.
3. Configurare Environment Variables:
   - `VITE_SUPABASE_URL`;
   - `VITE_SUPABASE_PUBLISHABLE_KEY`;
   - `SUPABASE_URL`;
   - `SUPABASE_PUBLISHABLE_KEY`;
   - `SUPABASE_SERVICE_ROLE_KEY`, solo se resta necessario lato server.
4. Verificare preview deployment da branch.
5. Promuovere o deployare produzione su dominio `*.vercel.app`.
6. Aggiornare redirect URL in Supabase Auth.

Checklist minima:

- il dominio `*.vercel.app` carica la landing;
- registrazione/login funzionano sul nuovo backend;
- i dati migrati sono visibili solo all'utente corretto;
- le route autenticate non espongono dati senza sessione;
- i download PDF/XML funzionano;
- password reset torna al dominio Vercel;
- nessuna variabile segreta è presente in git.

## Variabili ambiente target

Su Vercel:

| Variabile                       | Scope           | Note                                                        |
| ------------------------------- | --------------- | ----------------------------------------------------------- |
| `VITE_SUPABASE_URL`             | client + server | URL nuovo progetto Supabase                                 |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | client + server | Publishable/anon key nuovo progetto                         |
| `VITE_SUPABASE_PROJECT_ID`      | client + server | Project ref nuovo Supabase                                  |
| `SUPABASE_URL`                  | server          | Stesso URL del nuovo progetto                               |
| `SUPABASE_PUBLISHABLE_KEY`      | server          | Publishable/anon key                                        |
| `SUPABASE_SERVICE_ROLE_KEY`     | server only     | Solo se resta necessario lato server; mai esporre al client |

Da non migrare:

- `LOVABLE_API_KEY`, perché non risulta usata nel codice e va rimossa insieme al
  vecchio ambiente.

## Fase 5 — Cutover

1. Congelare Lovable: niente nuove modifiche e niente nuovi dati.
2. Eseguire export finale dati/auth.
3. Importare nel nuovo Supabase.
4. Creare l'utente nel nuovo Supabase e preservare l'UUID originale solo se il
   test preliminare lo conferma; altrimenti rimappare `profiles.id` e i
   `user_id`.
5. Deployare la versione puntata al nuovo backend.
6. Testare end-to-end su Vercel.
7. Tenere Lovable in sola lettura per una finestra breve di rollback.
8. Quando la verifica è conclusa, disconnettere o chiudere Lovable.

## Fase 6 — Bonifica totale dei riferimenti

Il cutover non basta: al termine della migrazione non deve restare nessun
riferimento a Lovable nel working tree del progetto. Questa stessa guida, l'ADR
di migrazione e le note storiche che nominano Lovable sono documenti
temporanei: servono durante l'uscita, poi vanno rimossi o riscritti.

Aggiornare o rimuovere:

- `AGENTS.md` per rimuovere regole specifiche Lovable;
- `README.md`;
- `docs/guides/architettura.md`;
- `docs/guides/database.md`;
- `docs/guides/deploy.md`;
- `docs/guides/migrations.md`;
- `docs/memory/` come mirror leggibile;
- `CHANGELOG.md`;
- `ROADMAP.md`;
- questa guida, che va eliminata o sostituita da una guida neutra su deploy e
  backend;
- l'ADR 0009 e ogni ADR storico che contiene riferimenti a Lovable, che vanno
  rimossi o sostituiti da decisioni correnti;
- `package.json`, `package-lock.json`, `vite.config.ts`, commenti, errori e
  messaggi runtime che nominano `@lovable.dev` o Lovable.

Verifica obbligatoria:

```bash
rg -i "lovable|@lovable\\.dev" .
```

Il comando deve restituire zero risultati nel working tree. La storia Git
continuerà a contenere riferimenti storici, salvo riscrittura esplicita della
history: quella è un'operazione distruttiva e va decisa separatamente.

## Rischi principali

| Rischio                                  | Mitigazione                                                                                      |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Export auth incompleto                   | Con un solo utente, creare nuovo utente e forzare reset password                                 |
| UUID auth non preservabile via Admin API | Test su progetto Supabase vuoto; fallback con nuovo UUID e rimappatura `profiles.id` / `user_id` |
| `user_id` diverso nel nuovo backend      | Script SQL di rimappatura controllato tabella per tabella                                        |
| Config Lovable nascosta                  | Inventario prima della migrazione, poi rimozione graduale                                        |
| Config Vercel errata                     | Preview deployment e log Vercel prima del cutover                                                |
| Env mancanti in produzione               | Checklist Environment Variables e test login/reset password                                      |
| File generati non allineati              | Rigenerare types dal nuovo Supabase                                                              |

## Criteri di completamento

Lovable può essere chiuso quando:

- il dominio Vercel `*.vercel.app` serve Pratix in HTTPS;
- Pratix usa solo il nuovo backend;
- l'utente esistente accede o ha completato reset password;
- i dati migrati sono coerenti;
- build e lint passano;
- non esistono secrets del vecchio ambiente necessari al runtime;
- il repo documenta solo il nuovo flusso;
- `rg -i "lovable|@lovable\\.dev" .` restituisce zero risultati nel working tree;
- il vecchio progetto Lovable non riceve piu traffico ne scritture.
