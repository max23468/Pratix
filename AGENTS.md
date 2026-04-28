# AGENTS.md

## Repository Expectations

- This is a Lovable-generated TanStack Start/Vite React app.
- Use `npm` for dependency installation because the repository includes `package-lock.json`.
- Do not manually duplicate plugins already provided by `@lovable.dev/vite-tanstack-config` in `vite.config.ts`.
- Keep changes focused and avoid unrelated formatting churn.

## Language And Product Copy

- Work with the project owner in Italian by default.
- The product/tool UI must be written in Italian unless a specific feature explicitly requires another language.
- User-facing copy, labels, validation messages, empty states, and documentation intended for end users should be in Italian.
- Keep code identifiers in English when that better matches existing library and framework conventions.

## Setup

- Install dependencies with `npm ci`.
- Use `npm run build` as the primary validation command.
- Use `npm run lint` when changes touch TypeScript, React, routing, or shared UI components.
- Use `npm audit --audit-level=moderate` after dependency changes.

## Review Guidelines

- Check for broken routing in `src/routes`.
- Check that UI changes remain responsive on mobile and desktop.
- Check that dependency updates do not drift `package.json` and `package-lock.json` out of sync.
- Flag security issues in user input handling, generated HTML, links, forms, and dependency changes.
