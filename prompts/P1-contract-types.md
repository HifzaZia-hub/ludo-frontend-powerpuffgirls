# P1 — Contract types, config, board geometry

**Implements:** NFR-SYS-11 (rules and board in config, not in components)
**Read first:** `CLAUDE.md`, `docs/01-contract.md`, `docs/02-board-model.md`

No UI, no network, no state. Types and pure functions only.

## 1. `src/contract/types.ts`
Transcribe every type in `docs/01-contract.md` §5 exactly, plus the REST
request/response types. Types only. No invented fields. A header comment:
"Mirrors the backend LGS contract. The backend's package wins any
disagreement."

## 2. `src/contract/errors.ts`
- `ErrorCode` union (all 21 codes).
- `RESYNC_CODES` = `PIECE_NOT_FOUND`, `NOT_YOUR_TURN`, `GAME_NOT_IN_PROGRESS`.
- `FIELD_ERRORS`: which form field each code belongs to (`INVALID_NAME`,
  `NAME_TAKEN` → name; `INVALID_CODE`, `ROOM_NOT_FOUND`, `ROOM_FULL`,
  `GAME_ALREADY_STARTED` → roomCode).

## 3. `src/contract/events.ts`
`EventType` union (all 16) and `ServerEvent`.

## 4. `src/config/` — configuration (NFR-SYS-11)

- `board.ts` — copy `TRACK_CELLS`, `HOME_COLUMN_CELLS`, `START_SQUARE`,
  `YARD_ORIGIN`, `YARD_SLOTS` from `docs/02-board-model.md` **exactly**.
  They are already verified. Do not regenerate or "improve" them.
- `players.ts` — colour → `{ letter, shape, token }` from
  `docs/03-ui-spec.md` §3. The only place that maps a colour to anything.
- `defaultRules.ts` — a `RuleConfig` with the LGS defaults from
  `01-contract.md` §5. Used **only** for the rules summary before a game.
- `app.ts` — `PERSIST_SETTINGS = true` (ALT-10-1 is TO CONFIRM).

## 5. `src/config/geometry.ts` — pure functions
- `pieceCell(piece)`, `squareForStep(colour, step)`, `pathSteps(from, to)`,
  `isSafeSquare(square, safeSquares)`, `stackOffsets(count)`,
  `progressCounts(pieces, colour)` (from `02-board-model.md` §6)

No imports from React, the store or the adapter.

## 6. `src/config/geometry.test.ts`
- 52 track cells, no duplicates.
- Step 1 per colour: RED→[1,6], GREEN→[8,1], YELLOW→[13,8], BLUE→[6,13].
- Step 51's square is **orthogonally adjacent** to that colour's first
  home-column cell (write a real adjacency check — this catches a broken ring).
- No track cell overlaps a home-column cell or `[7,7]`.
- Yard slots for R1–R4; centre for step 57.
- `pathSteps(0,1)` → `[1]`; `pathSteps(10,16)` → `[11…16]`.
- `progressCounts`: a mix of steps 0, 3, 54, 57 → `{ base:1, track:2, home:1 }`.

## Done when
`npm test` and `npm run typecheck` pass, and nothing in `src/contract` or
`src/config` decides anything about the game.
