# ludo-frontend-powerpuffgirls

Ludo Game Platform - Front End - Power Puff Girls - SE Fall 2026

The browser front end for a multiplayer Ludo game, built by team Power Puff Girls. The server
owns every game rule. This app sends requests, shows the latest accepted game state, and explains
when something is rejected.

## Run it

You need Node.js (current LTS) and npm.

```
npm install
cp .env.example .env
npm run dev
```

Then open the address Vite prints, usually <http://localhost:5173>.

`VITE_SERVER_URL` in `.env` sets which game server the app talks to.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Starts the dev server |
| `npm run build` | Type-checks, then builds to `dist/` |
| `npm run preview` | Serves the built app |
| `npm run typecheck` | Runs the TypeScript checks |
| `npm run lint` | Runs ESLint |
| `npm run format` | Formats the code with Prettier |
| `npm test` | Runs the tests once |
| `npm run mock` | Placeholder until the mock server is added in task P2 |

## Where to look

- `CLAUDE.md`: project rules and the folder layout
- `docs/00-requirements.md`: what we must build
- `docs/01-contract.md`: how we talk to the server
- `docs/04-build-plan.md`: the task order
- `docs/05-traceability.md`: where each requirement is met and proved
- `docs/prototype/`: our early HTML prototype, kept for reference and not part of the app
