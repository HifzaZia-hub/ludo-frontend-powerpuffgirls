# P8 — Move choice, preview, step animation

**Implements:** FR-SYS-03 (legal choices and move), FR-SYS-05 (step-by-step
movement, animation off), FR-SYS-04 (invalid move explained, state kept),
D2 FR-38 (skip animations)
**Read first:** `docs/00-requirements.md` (FR-SYS-03/04/05),
`docs/02-board-model.md` §4–§5, `docs/03-ui-spec.md` S5 and §5, the
`ludo-contract` skill

## Selection (FR-SYS-03)
Source of truth: `turn.legalMoves`. Nothing else.
- A piece is a focusable button **only** if its id is in `legalMoves`
  (POST-03-1). Others are dimmed and not focusable.
- Select by click, by `1`–`4`, or by Tab to the piece. Selecting shows:
  - a ghost marker on the destination (`pieceCell` of `move.toStep`) — FR-18
  - a red ring on any piece in `move.captures`
- Confirm with a second click, `Enter`, or the **Move** button.
- Side list of movable pieces as cards ("Piece 2 → enters home column").
- Never compute a destination yourself.

## Sending
`store.move(pieceId)`. All piece controls disabled while pending.
Do not move anything until the new snapshot arrives (EXC-03-2).
- `ILLEGAL_MOVE` → show the server's reason, clear selection, keep state
  (FR-SYS-04).
- Piece no longer legal (`PIECE_NOT_FOUND` / stale) → show the reason and
  resync to refresh the options (EXC-03-1).

## Animation (FR-SYS-05)
On `MOVED`, walk through `pathSteps(fromStep, toStep)`:
- per-step time from the Animations setting (On 120 ms / Fast 50 ms / Off 0)
- leaving base is one hop
- the moving piece renders on top
- **Skip:** `S` key or a Skip button finishes all running animations instantly

**The snapshot always wins.** Animation is a visual offset only; the real
position is always `pieceCell(piece)` from the current snapshot. If a new
snapshot arrives mid-walk, cancel and settle on the snapshot's position.

Test POST-05-2: with Animations Off, the board after a move is identical to
the board with Animations On after it finishes.

## No legal move
`TURN_PASSED` → "<Name> can't move. Turn skipped." (R6). Never render an empty
chooser. If `rules.autoMoveSingleOption` is true, the server moves; render no
chooser.

## Done when
A full game vs 3 computers can be played to the end **by mouse**, and again
**by keyboard only**. Use the mock's `capture-ready` scenario: the preview
rings the piece that would be captured. Force an illegal move (via the mock
or a test) and show the board is unchanged. An animation interrupted by a new
snapshot ends where the snapshot says.
Update traceability rows FR-SYS-03, FR-SYS-04, FR-SYS-05.
