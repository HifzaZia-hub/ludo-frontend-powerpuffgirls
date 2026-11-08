---
name: ludo-contract
description: Rules for any Ludo front-end code that touches game state or the server — the GameAdapter, LGS socket/REST calls, snapshots, versions, errors, piece positions, legal moves, turns, dice, AI seats. Use whenever a task involves src/adapter, src/store, src/contract, src/config/board.ts, or any component that reads game state. Also use when debugging desync, stale state, a piece in the wrong place, or unexpected server errors.
---

# Ludo server integration rules

Read `docs/01-contract.md` for exact shapes and `docs/02-board-model.md` for
anything positional. Requirement IDs refer to `docs/00-requirements.md`.

## The hard rule

Game logic is authoritative (our D3 §3.1). Before writing any function, ask:
*does this decide something about the game?* If yes, delete it.

Forbidden on the client:
- generating a dice value, even for an animation preview (NFR-SYS-05)
- deciding legality, captures, extra turns, turn order, winner, ranking or score
- setting a piece's `step` to anything a snapshot did not say
- moving a piece before the server accepts (FR-SYS-03 EXC-03-2)
- inventing an event the server did not send (FR-SYS-05 EXC-05-1)

Allowed (display, not decisions):
- `pieceCell(piece)` — step → screen cell
- `pathSteps(from, to)` — the squares to walk through for animation
- `progressCounts(pieces, colour)` — base/track/home counts (FR-SYS-06)
- reading `turn.legalMoves` to decide which pieces are **clickable**
- comparing `turn.activePlayerId` to `myPlayerId` to enable the roll button
- tallying server-reported winners for the session score (FR-29)

Highlighting a piece because it is in `legalMoves` is rendering.
Deciding it *should* be in `legalMoves` is cheating.

## The adapter boundary (NFR-SYS-12)

- **Only `src/adapter/` imports `socket.io-client` or calls `fetch`.**
- The store is created with a `GameAdapter` and only ever calls that interface.
- Tests use `FakeAdapter`. If a store test needs a real socket, the boundary
  is leaking — fix the design, not the test.
- Adapter methods never throw for a server-side failure. They resolve to
  `{ ok: false, error }`. Only programmer errors throw.

## Snapshot handling

```ts
function applySnapshot(next: GameStateSnapshot) {
  const current = get().snapshot;
  // A restart begins again at version 1 with a new matchId.
  if (current && current.matchId === next.matchId) {
    if (next.version <= current.version) return;                    // stale
    if (next.version > current.version + 1) adapter.sync(current.version); // gap
  }
  set({ snapshot: next });
}
```

- One snapshot in the store. No parallel copies of pieces, turn or players.
- Everything else is a selector.
- `game:event` drives animation, sound and the message log. Never positions.

## Commands

- `pendingCommand` is set from click until the ack returns. The control stays
  disabled the whole time (FR-SYS-02 EXC-02-1; server rate limit is 20/s).
- Ignore an ack whose `requestId` is not the current one.
- On `{ ok: false }`: snapshot unchanged (FR-SYS-04 POST-04-1), friendly
  message from `src/feedback/copy.ts`, control re-enabled.
- `PIECE_NOT_FOUND`, `NOT_YOUR_TURN`, `GAME_NOT_IN_PROGRESS` mean our state
  is stale → call `resync()` automatically.
- No ack in 5 s → treat as `INTERNAL_ERROR`, keep state, offer retry
  (FR-SYS-04 EXC-04-1).

## Connection

- `sessionToken` in `sessionStorage`. Never log, render or put it in a URL.
- socket.io reconnects by itself. Don't write a retry loop.
- On reconnect → `sync(knownVersion)`.
- On `session:replaced` → stop and show "open in another tab".

## Field names

If `docs/01-contract.md` doesn't name a field, **stop and ask**. Add guesses
to the open-questions checklist at the bottom of that file. A guessed field
name costs the other team a day.

## Where our D3 and the LGS disagree

Check `docs/00-requirements.md` §5 before deciding anything about colour
choice, same-device play, extra-turn rules, ranking, or who runs the AI.

## Typical bugs this prevents

| Symptom | Cause |
|---|---|
| Piece jumps back after moving | optimistic move overwritten by a snapshot |
| Die shows 4, piece moves 2 | animation landed on a random face, not `turn.lastRoll` |
| Board frozen after reconnect | no `sync()` on reconnect |
| "Wait for your turn" toasts | gating on a stored copy instead of a selector |
| Duplicate pieces | keys by index instead of `piece.id` |
| Rules text says one thing, server does another | rules summary hard-coded instead of built from `snapshot.rules` |
