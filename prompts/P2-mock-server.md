# P2 — Mock LGS

**Implements:** nothing directly — it unblocks every later task and lets us
prove NFR-SYS-12 (the UI works with any server that speaks the contract).
**Read first:** `docs/01-contract.md`, `docs/02-board-model.md`

The real backend is another team's and is not ready. Build a mock that speaks
the exact same contract so we can develop and demo without them.

## Shape

A small standalone Node + TypeScript server in `mock-server/`, run with
`npm run mock` on port 3001, using express + socket.io v4. It is a **dev
dependency of our repo, not part of the build**. It must never be imported by
anything in `src/`.

Why a real server and not an in-browser fake: we want to exercise the actual
socket.io client, real acks, real disconnects and two real browser tabs playing
each other. An in-process fake hides exactly the bugs we care about.

## What it must implement

Faithfully, because the whole point is that swapping `VITE_SERVER_URL` to the
real LGS changes nothing in our code:

- `POST /api/v1/rooms`, `POST /api/v1/rooms/:code/join`,
  `GET /api/v1/rooms/:code`, `GET /api/v1/health`
- Room codes from the alphabet `ABCDEFGHJKMNPQRSTUVWXYZ23456789`, 6 chars
- Socket auth via `auth.sessionToken`; reject with `UNAUTHORIZED`
- Commands: `room:addAi`, `room:leave`, `game:start`, `game:roll`, `game:move`,
  `game:restart`, `state:sync`
- Acks: `{ ok: true, version }` / `{ ok: false, error }`
- Emits `room:updated`, `game:state`, `game:event`, `error`, `session:replaced`
- `game:event` **before** `game:state` for the same version
- A monotonic `version`, starting at 1 per match
- `v: "1.0.0"` on every message

## Game rules in the mock

Implement rules G-1 to G-13 (see `docs/02-board-model.md` §7 and the
backend D3): leave the yard on a 6, exact roll to finish, capture on non-safe
squares, bonus on six/capture/finish, three-sixes forfeit, 30s turn timer,
clockwise order, winner on four pieces home, AI stand-in.

Yes — the rules live here. This is the **server**. That is the one place in this
repository where game logic is allowed. Keep it physically separate from `src/`
so nobody is ever tempted to import it into the client. Add an ESLint rule
(`no-restricted-imports`) that blocks importing `mock-server/` from `src/`.

Add a simple `NORMAL` AI: score each legal move (finish +100, capture +80,
leave yard +60, land on safe +40, otherwise + steps/10) and take the best.
`EASY` picks a random legal move. Pause `aiDelayMs` (default 700) before acting.

## Dev conveniences (must be off by default)

Behind `?debug=1` query params on the socket handshake, not on by default:
- `forceRoll` — a REST endpoint `POST /debug/force-roll { value }` so we can
  reproduce a specific scenario (e.g. always roll 6) when testing captures
- `POST /debug/scenario { name }` to jump to a prepared state:
  `near-win` (one player with 3 pieces home and one on step 54),
  `capture-ready` (two pieces one square apart on a non-safe square),
  `three-sixes`, `no-legal-move`

These four scenarios will save you hours in tasks P8–P11. Build them.

Also add `POST /debug/rules { …partial RuleConfig }` to change rules for the
next match (e.g. different `safeSquares`). P6 uses it to prove NFR-SYS-11:
change the config, and the board and rules summary follow.

## Done when
- `npm run mock` starts on 3001
- With curl: create a room, join it, preview it, health check — all return the
  documented shapes
- Two browser tabs with a tiny throwaway socket script can create, join, start,
  roll and move, and both see every state
- A full solo game vs 3 AI players can be played to a winner through socket
  commands alone

Paste the curl output for create + join, and confirm a full AI-only game ran to
`GAME_OVER`.
