# ADR 0001 — Stack frontend: TanStack Start

- **Stato**: Accettato
- **Data**: 2026-04-29

## Contesto

Pratix è un'app web full-stack che richiede:
- routing tipato lato client e server,
- SSR per SEO della landing pubblica e per share link,
- server functions per logica protetta (generazione XML FatturaPA, integrazioni),
- deploy semplice su edge runtime (Cloudflare Worker via Lovable),
- ecosistema React 19 e Vite per DX moderna.

Lo scaffolding di Lovable propone TanStack Start v1 come template ufficiale.

## Decisione

Adottiamo **TanStack Start v1** con **Vite 7** e React 19 come framework full-stack. File-based routing in `src/routes/`, server functions con `createServerFn`, server routes per webhook in `src/routes/api/public/*`.

## Conseguenze

- ✅ Routing tipato end-to-end, type-checking dei link.
- ✅ SSR + SSG dove serve, idratazione automatica.
- ✅ Compatibile con runtime Worker (con `nodejs_compat`).
- ✅ Allineato col template Lovable (zero attriti su deploy).
- ⚠️ `src/routeTree.gen.ts` auto-generato — **mai modificare** a mano.
- ⚠️ Vincoli runtime Worker: niente `child_process`, `sharp`, `puppeteer`, `fs.watch`.
- ⚠️ Convenzioni rigide su naming dei file di route (flat dot-separated, non directory).

## Alternative considerate

- **Next.js** — ottimo ma overkill, attriti col runtime Worker, accoppiamento maggiore al vendor (Vercel).
- **Remix** — buono ma fuori dal template Lovable, ridurrebbe la velocità di iterazione.
- **SPA pura con React Router** — niente SSR/SEO, peggio per la landing pubblica.

## Riferimenti

- [`docs/guides/architettura.md`](../guides/architettura.md)
- [`AGENTS.md`](../../AGENTS.md)
