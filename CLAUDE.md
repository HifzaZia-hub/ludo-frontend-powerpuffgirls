# CLAUDE.md — Ludo Front End (team: Power Puff Girls)

Read this file fully before any task.

## 1. What this project is

We build **only the front end** of a multiplayer Ludo game.

- **What we must build:** `docs/00-requirements.md` — our own D2/D3
  requirements (FR-SYS-01…10, NFR-SYS-01…14). This is what we are graded on.
- **How we talk to the server:** `docs/01-contract.md` — the backend team's
  Ludo Game Server (LGS) contract.

**Game logic is authoritative** (D3 §3.1). The server owns the dice, rules,
legal moves, captures, extra turns, turn order, timers, AI and the winner.

### IMPORTANT: never implement a Ludo rule on the client

The front end may NOT generate or guess a dice value, decide if a move is
legal, decide captures, decide whose turn it is, decide the winner, compute a
ranking or score, or put a piece anywhere a server snapshot did not.

The front end ONLY sends requests, renders the latest accepted snapshot, shows
the server's explanation when something is rejected, and animates **between
two accepted snapshots**.

If a task seems to need rule logic on the client, stop and ask.

## 2. Tech stack (locked)

Vite · React 18 · TypeScript (strict) · Tailwind CSS · Zustand ·
socket.io-client v4 · Framer Motion · canvas-confetti · howler · uuid.
Optional, task P14 only: @react-three/fiber + @react-three/drei.
Package manager: npm.

No other library without asking. No Redux, no router library, no UI kit,
no CSS-in-JS.

## 3. Architecture (D3 §3.2) and folders

```
Presentation  ──  src/screens, src/components      draw from state only
Interaction   ──  src/interaction                  keyboard/mouse, selection, navigation
Feedback      ──  src/feedback                     messages, sound, animation prefs
Settings      ──  src/store/settingsStore.ts       sound, animation, theme
State manager ──  src/store                        latest accepted snapshot + selectors
Adapter       ──  src/adapter                      THE ONLY way out to game logic / AI
Config        ──  src/config                       board geometry, default rules (NFR-SYS-11)
Contract      ──  src/contract                     types + error codes mirrored from LGS. No logic.
```

Rules for the layers:
- **Only `src/adapter/` may import `socket.io-client` or call `fetch`.**
  Everything else talks to the `GameAdapter` interface (NFR-SYS-12).
- Components never import the adapter. Screens read the store and call store
  actions; the store calls the adapter.
- `src/config/board.ts` holds layout maths (step → cell). That is geometry,
  not rules, and it is allowed. Rule values (safe squares, extra turns, timer)
  come from `snapshot.rules`, never from constants in components.
- `src/contract/` holds types only.

## 4. State rules

- One source of truth: the latest `game:state` snapshot in `gameStore`.
- Apply a snapshot only if `incoming.version > current.version`.
- If an incoming version is more than 1 ahead, send `state:sync`.
- Everything derived (my turn, can roll, movable pieces, progress counts) is a
  **selector**, never a second stored copy.
- A rejected or failed request changes nothing in the snapshot (FR-SYS-04).
- `sessionToken` lives in `sessionStorage`. Never log or render it.
- Only `settingsStore` uses `localStorage` (NFR-SYS-14).

## 5. Code conventions

- `strict: true`. No `any`. No `!` without a comment saying why it is safe.
- Function components, named exports, one component per file, `XxxProps`
  interface above it.
- Tailwind only. Colours from CSS variables (`var(--accent)`), never raw hex,
  so light/dark themes work.
- `PascalCase.tsx` for components, `camelCase.ts` for the rest.
- Comments explain *why*. Put the requirement ID next to code that exists
  because of it: `// FR-SYS-03 EXC-03-2: never move before the server accepts`.

## 6. Must-haves on every screen (from our NFRs)

- **Keyboard:** everything works without a mouse (NFR-SYS-08).
- **Not colour alone:** every player colour also has a letter and a shape
  (NFR-SYS-07).
- **Simple words:** short, friendly messages a 12-year-old understands
  (NFR-SYS-08). Use the copy table in `docs/03-ui-spec.md`.
- **Instant feedback:** every control shows a pressed or pending state at once
  (NFR-SYS-01).
- **Reduced motion:** respect `prefers-reduced-motion` and the animation
  setting.
- **Confirm** before anything that throws away a game in progress (FR-SYS-08).

## 7. Definition of done

1. `npm run typecheck`, `npm run lint`, `npm run build`, `npm test` all pass.
2. It works against the mock server (`npm run mock` + `npm run dev`).
3. No rule logic on the client (section 1).
4. Each requirement ID the task lists is met, with its PRE/POST conditions.
5. `docs/05-traceability.md` updated for those IDs.
6. A short report: what changed, what you did **not** do.

Never say something works if you did not run it.

## 8. How I want you to work

- One task at a time. Show a short plan first and wait for approval.
- If `docs/01-contract.md` does not name a field, **stop and ask**. Never
  invent a field name.
- If our requirements and the server disagree, check
  `docs/00-requirements.md` §5. If it is not listed there, stop and ask.
- Commit messages: conventional commits with the requirement ID,
  e.g. `feat(dice): show server roll value (FR-SYS-02)`.

## 9. Priority

MVP first, in build-plan order (`docs/04-build-plan.md`, tasks P0–P12).
Polish (P13 local multi-seat, P14 3D/extra themes/confetti) only after the
MVP is tagged.

When compacting, always keep: the current task number, the requirement IDs it
covers, and the list of files changed so far.
