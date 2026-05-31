# Toolchain Pratix

Questo documento dichiara runtime, strumenti e verifiche operative di Pratix. Le regole applicative restano in `AGENTS.md`, nelle guide e nelle ADR.

## Runtime e stack

- Frontend/app: React 19 + TanStack Start v1.
- Build: Vite con Nitro e target Vercel.
- Routing: file-based routing in `src/routes/`, con route tree generato in `src/routeTree.gen.ts`.
- Backend: Supabase di proprietà del progetto, PostgreSQL con RLS, Auth passwordless, passkey dietro feature flag e Storage privato.
- Deploy: Vercel, produzione `https://pratix.vercel.app`.
- UI: Tailwind CSS v4, shadcn/Radix, `lucide-react`, token semantici in `src/styles.css`.
- Lingua: italiano, `lang="it"`.

## Node e package manager

- Node richiesto: `24.x`.
- npm richiesto: `>=11 <12`.
- Package manager dichiarato: `npm@11.14.1`.
- Lockfile autoritativo: `package-lock.json`.
- Lockfile alternativi non ammessi.

## File generati da non modificare a mano

- `src/routeTree.gen.ts`
- `src/integrations/supabase/types.ts`
- `.env` locale non tracciato

## Comandi principali

```sh
npm ci
npm run dev
npm run build
npm run lint
npm test
npm run ci:local
npm run prepush:guard
```

Formattazione:

```sh
npm run format:changed:check
npm run format:changed
```

Release e pubblicazione:

```sh
npm run release:dry-run
npm run release
npm run publish:prepare
npm run publish:finish -- --pr <numero-pr> --routes /,/novita
```

Qualità UI/React:

```sh
npm run quality:react-doctor
npm run smoke:a11y
npm run smoke:a11y:quick
npm run smoke:a11y:auth
```

Supabase:

```sh
npm run db:push:dry-run
npm run db:advisors:security
npm run db:advisors:performance
npm run db:verify
npm run db:types
```

## Verifiche proporzionate

Pratix usa corsie di pubblicazione:

- veloce: docs interne, ADR, roadmap, regole agenti, memoria o `Non versionato` non esposto in app;
- standard: changelog, testi pubblici, microcopy esposta o piccola UI locale;
- completa: routing, componenti condivisi, auth, database, dipendenze, release, automazioni o UI sostanziale.

Mappa rapida:

| Tipo modifica                                                                                       | Corsia   | Verifiche minime                                                                 |
| --------------------------------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------- |
| Sola analisi                                                                                        | veloce   | Nessun test applicativo; dichiarare fonti e limiti                               |
| Docs interne/governance                                                                             | veloce   | Rilettura, coerenza, `git diff --check`, `npm run format:changed:check` se utile |
| Changelog, testi pubblici, microcopy                                                                | standard | Check specifico, verifica pagina/HTTP mirata quando esposto                      |
| Test-only o runtime piccolo                                                                         | standard | Test mirati; lint/build solo se tocca TypeScript, routing o contratti            |
| Runtime condiviso, auth, database, provider/API, deploy/config, release/versioning o UI sostanziale | completa | `npm run prepush:guard` o equivalenti, smoke/a11y quando praticabile             |

La pubblicazione completa resta PR/merge su `main`, Vercel production verificata quando serve e cleanup branch/worktree. Cambia solo la profondità dei gate tecnici.

## CI e GitHub

- Workflow Quality sulle PR verso `main`.
- Codex feedback inbox obbligatoria prima di PR ready, merge e pubblicazione.
- Dependabot e controlli npm proporzionati ai cambi manifest/lockfile.
- PR title e template coerenti con Conventional Commit.

## Versioning

- Single source of truth versione: `src/lib/version.ts`.
- Changelog: `CHANGELOG.md`.
- Release locale: `npm run release`.
- Nessuna release per piani, ADR, guide interne e regole agenti non esposte nell'app.

## Provider e segreti

- GitHub conserva codice, documentazione, configurazione pubblicabile e migrations.
- Vercel conserva secret runtime e pubblica produzione/preview.
- Supabase gestisce database, auth, RLS, Storage e provider secret.
- Non committare `.env`, token, dump, backup, export reali o dati personali.
