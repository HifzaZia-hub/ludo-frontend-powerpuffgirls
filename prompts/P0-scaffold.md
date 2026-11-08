# P0 — Scaffold

**Implements:** NFR-SYS-13 (structure), groundwork for FR-SYS-10 (themes)
**Read first:** `CLAUDE.md`, `docs/03-ui-spec.md` §2

Set up a Vite + React + TypeScript project in this directory. The stack is
locked — see `CLAUDE.md` §2.

## Install
- Vite `react-ts` template
- tailwindcss, postcss, autoprefixer
- zustand, socket.io-client, framer-motion, howler (+ @types/howler),
  canvas-confetti (+ types), uuid (+ types)
- dev: eslint (+ typescript-eslint, react-hooks plugin), prettier, vitest,
  @testing-library/react, @testing-library/user-event, jsdom

Do **not** install react-three-fiber. That is P14.

## Configure
- tsconfig: `strict`, `noUncheckedIndexedAccess`, `noUnusedLocals`.
  Alias `@/*` → `src/*` (in both tsconfig and vite config).
- Tailwind: content globs for `index.html` and `src/**/*.{ts,tsx}`. Map our CSS
  variables into `theme.extend.colors` (`bg-panel`, `text-high`, `accent`,
  `p-red`, …), each as `var(--token)`.
- `src/styles/theme.css`: copy **both** token blocks (dark and light) from
  `docs/03-ui-spec.md` §2 exactly. Import it in `main.tsx`.
- `index.html`: `<html data-theme="dark">`.
- ESLint flat config + Prettier (100 cols, double quotes, trailing commas).
- `.env.example`: `VITE_SERVER_URL=http://localhost:3001`. Gitignore `.env`.

## Scripts
`dev`, `build`, `preview`, `typecheck` (tsc --noEmit), `lint`, `format`,
`test`, `mock` (placeholder for P2 — just `echo "added in P2"` for now).

## Folders
Create every folder from `CLAUDE.md` §3 with a one-line `README.md` saying
what belongs there. Also `docs/evidence/`. No feature code yet.

## Starter page
`App.tsx`: centred page, "LUDO" in display type, one primary button, four
player dots, and a small Dark/Light switch that sets `data-theme` on `<html>`.
This only proves the tokens work in both themes.

## Also
`README.md` (what this repo is, how to run, scripts), `CHANGELOG.md` with a
line for P0.

## Done when
The starter page looks right in **both** themes, and typecheck, lint and build
pass. Paste the command output.
