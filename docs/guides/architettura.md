# Guida — Architettura

## Stack

- **Framework**: TanStack Start v1 (full-stack React 19)
- **Build**: Vite 7
- **Routing**: file-based in `src/routes/`, route tree auto-generato
- **Backend**: Supabase di proprietà del progetto — Postgres, Auth passwordless, passkey dietro feature flag e Storage privato
- **Deploy**: Vercel
- **Styling**: Tailwind v4 con `@import` in `src/styles.css`
- **UI**: shadcn/ui + Radix + lucide-react
- **State server**: TanStack Query
- **Form**: react-hook-form + Zod
- **Lingua UI**: italiano (`lang="it"`)

## Struttura cartelle

```
src/
├── routes/                 ← file-based routing, una pagina = un file
│   ├── __root.tsx          ← layout radice (no-flash tema, head, body)
│   ├── index.tsx           ← landing pubblica
│   ├── dashboard.tsx       ← UI autenticata
│   ├── pratiche.*.tsx      ← sezione pratiche
│   ├── clienti.*.tsx       ← sezione clienti
│   ├── fatture.*.tsx       ← sezione fatture
│   ├── impostazioni.tsx    ← configurazione fatturazione e preferenze operative
│   ├── login.tsx, register.tsx
│   └── api.*.ts            ← server routes (cron, webhook, endpoint HTTP)
├── components/
│   ├── ui/                 ← shadcn primitives (non modificare a cuor leggero)
│   ├── brand/              ← Logo e asset di marca
│   ├── app-layout.tsx      ← layout app autenticata + sidebar
│   ├── app-sidebar.tsx
│   ├── theme-toggle.tsx
│   ├── onboarding-dialog.tsx
│   ├── invoice-form.tsx
│   └── …
├── hooks/                  ← custom hook
├── lib/
│   ├── theme-context.tsx   ← provider tema (auto/light/dark)
│   ├── invoice-pdf.ts      ← generazione PDF fattura
│   ├── invoice-xml.ts      ← generazione XML FatturaPA TD06
│   ├── storage-paths.ts    ← bucket e path Supabase Storage
│   └── utils.ts
├── server/                 ← server functions (createServerFn)
├── integrations/supabase/
│   ├── client.ts           ← client condiviso
│   └── types.ts            ← AUTO-GENERATO, mai modificare
├── styles.css              ← token semantici, tema light/dark
└── routeTree.gen.ts        ← AUTO-GENERATO, mai modificare
```

## Routing

File-based, naming flat con punti:

| File                          | URL                 |
| ----------------------------- | ------------------- |
| `routes/index.tsx`            | `/`                 |
| `routes/dashboard.tsx`        | `/dashboard`        |
| `routes/pratiche.index.tsx`   | `/pratiche`         |
| `routes/pratiche.$caseId.tsx` | `/pratiche/:caseId` |
| `routes/api.cron.daily.ts`    | `/api/cron/daily`   |

**Regole TanStack Start importanti** (sintesi):

- Mai creare `src/pages/` o `src/routes/_app/index.tsx`.
- Mai modificare `src/routeTree.gen.ts`.
- Ogni `<Link to="...">` deve puntare a un file di route esistente (typecheck rigido).
- Ogni route con loader deve avere `errorComponent` e `notFoundComponent`.
- Per webhook, cron o endpoint HTTP esterni usare server routes `src/routes/api.*.ts` o `src/routes/api.public.*.ts`, con verifica firma/HMAC quando l'endpoint è richiamato da terzi.

## Tema

- Provider: `src/lib/theme-context.tsx`
- Modalità: `auto` (segue sistema) | `light` | `dark`
- Toggle: `<ThemeToggle>` in sidebar, landing, impostazioni
- No-flash script inline in `__root.tsx` per evitare FOUC

Token CSS in `src/styles.css`:

- Token semantici dinamici per tema (`--background`, `--foreground`, `--primary`…)
- Token brand fissi cross-tema (`--color-brand-navy/cream/gold`) per logo e asset

Vedi [tema-e-design](./tema-e-design.md) per il dettaglio.

## Server-side

- **Server functions**: `createServerFn` da `@tanstack/react-start` per RPC tipato.
- **Server routes**: file `src/routes/api.*.ts` per HTTP grezzo (webhook, cron).
- **Storage Supabase**: bucket privato `pratix-documents`, con path
  owner-scoped `<user_id>/<area>/...` e policy su `storage.objects`.
- **Route API TanStack Start**: file `src/routes/api.*.ts`, pubblicati tramite Vercel insieme all'app.
- **Runtime deploy**: Vercel tramite TanStack Start + Nitro.

## Convenzioni

- **Identificatori in inglese** quando coerente con framework e librerie.
- **Testi UI in italiano**.
- **Componenti piccoli e composti**, no mega-component.
- **Token semantici, mai hex**.
- **Prefer search-replace** per modifiche puntuali.
- Mai toccare i file auto-generati elencati sopra.

Vedi anche [`AGENTS.md`](../../AGENTS.md) per regole operative complete.
