# AGENTS.md

## Repository Expectations

- This is a Lovable-generated TanStack Start/Vite React app.
- Use `npm` for dependency installation because the repository includes `package-lock.json`.
- Do not manually duplicate plugins already provided by `@lovable.dev/vite-tanstack-config` in `vite.config.ts`.
- Keep changes focused and avoid unrelated formatting churn.

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
