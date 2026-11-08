# P3 — GameAdapter and Zustand stores

**Implements:** NFR-SYS-12 (defined interfaces), NFR-SYS-04 (state kept on bad
input), NFR-SYS-14 (no storage for play), FR-SYS-04 (POST-04-1, EXC-04-1)
**Read first:** `CLAUDE.md`, `docs/01-contract.md` (§3–§9), the
`ludo-contract` skill

This is the most important task. Every desync bug for the rest of the term is
decided here. Go slowly.

## 1. `src/adapter/GameAdapter.ts`
The interface from `docs/01-contract.md` §9, exactly. Types only.

## 2. `src/adapter/LgsAdapter.ts`
Implements `GameAdapter` against the LGS (and our mock — same protocol).

- REST: typed calls. Never throws for an HTTP error; returns
  `{ ok: false, error }`. If the body isn't a `ServerError` (server down, HTML
  page), return `{ code: "INTERNAL_ERROR", message: "Could not reach the server." }`.
- Socket: `io(url, { auth: { sessionToken } })`. One socket per adapter.
- Commands wrap the ack callback in a promise with a **5 s timeout** that
  resolves to an `INTERNAL_ERROR` ack (EXC-04-1) — never hangs.
- `roll()` and `move()` attach a uuid `requestId`.
- No reconnect loop — socket.io does it. Map its events to
  `onConnection("connecting" | "live" | "reconnecting" | "lost")`.
- Never log the token.

## 3. `src/adapter/FakeAdapter.ts`
In-memory, for tests only. Lets a test:
- queue the ack a command will return
- push a snapshot / event / room / error / connection change to the handlers
- read the list of commands that were sent

## 4. `src/store/gameStore.ts`
Create the store with a factory: `createGameStore(adapter: GameAdapter)`.
`main.tsx` passes `new LgsAdapter(import.meta.env.VITE_SERVER_URL)`.

State: `snapshot`, `room`, `myPlayerId`, `connection`, `lastEvent`,
`eventLog` (last 50 events, for the message area), `pendingCommand`,
`toasts`.

Actions:
- `applySnapshot(next)` — drop if `version <=` current; if `> current + 1`,
  call `adapter.sync(current.version)` and still apply `next`.
- `applyEvent(e)` — set `lastEvent`, append to `eventLog`. **Never** changes
  `snapshot`.
- `applyRoom(room)`.
- `roll()` / `move(pieceId)` — set `pendingCommand`; await ack; clear it.
  On `{ ok: false }`: push a friendly toast (from `src/feedback/copy.ts` —
  create a stub with the table from `docs/03-ui-spec.md` §7) and auto-resync on
  `RESYNC_CODES`. Snapshot unchanged.
- `resync()`, `reset()`.

**Selectors** — exported functions, not stored fields:
`selectIsMyTurn`, `selectCanRoll`, `selectCanMove`, `selectLegalPieceIds`,
`selectLegalMoveFor(pieceId)`, `selectActivePlayer`, `selectMe`,
`selectProgress(playerId)` (uses `progressCounts`), `selectPiecesByCell`,
`selectSecondsLeft`, `selectIsComputerTurn`.

If you add a stored field like `isMyTurn`, you have made a bug.

## 5. `src/store/settingsStore.ts`
`theme` (`"dark" | "light"`), `sound` (bool), `animation`
(`"on" | "fast" | "off"`). Persist with Zustand `persist` **only if**
`PERSIST_SETTINGS` is true. Version number + migration stub.
Applying `theme` sets `data-theme` on `<html>`. This is the **only** file
that touches `localStorage` (NFR-SYS-14).

## 6. `src/adapter/useAdapterSubscription.ts`
A hook that subscribes the store to `adapter.on(...)` and unsubscribes on
unmount. On a `"live"` connection after `"reconnecting"`, call `resync()`.

## 7. Tests — `src/store/gameStore.test.ts`, all with `FakeAdapter`
- v5 then v4 → v5 stays (NFR-SYS-04)
- v5 then v7 → v7 applied **and** `sync(5)` sent
- `applyEvent` never changes `snapshot`
- a rejected `move` leaves `snapshot` deep-equal to before (POST-04-1)
- an ack with a stale `requestId` is ignored
- a timed-out command leaves state unchanged and clears `pendingCommand`
  (EXC-04-1)
- `NOT_YOUR_TURN` triggers `sync`; `INVALID_NAME` does not
- second `roll()` while one is pending sends nothing (EXC-02-1)

Also a lint rule: `no-restricted-imports` blocks `socket.io-client` outside
`src/adapter/`.

## Done when
All tests pass, typecheck passes, and the app connects to the mock server and
shows the connection status and first snapshot version in a debug line.
Update `docs/05-traceability.md` rows NFR-SYS-04, NFR-SYS-12, NFR-SYS-14.
