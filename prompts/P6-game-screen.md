# P6 — Game screen: board, status panel, message area

**Implements:** FR-SYS-09 (one screen), FR-SYS-06 (progress counts),
NFR-SYS-10 (window sizes), NFR-SYS-11 (rules from config), D2 FR-07 (rules
during the game), NFR-SYS-03 (no crash)
**Read first:** `docs/02-board-model.md`, `docs/03-ui-spec.md` §4 (S4),
the `ludo-ui` skill

Render the game from a snapshot. **Read-only this task** — no rolling or moving
yet. Just: given a `GameStateSnapshot`, show everything correctly.

## Layout (FR-SYS-09)
Follow the wireframe in `03-ui-spec.md` S4:

```
<GameScreen>
  <TopBar/>          menu · rules (?) · turn text · settings · sound
  <StatusPanel/>     one PlayerCard per player
  <Board>
    <BoardGrid/>     static, memoised
    <PieceLayer/>    positioned pieces
  </Board>
  <DicePanel/>       placeholder until P7
  <MessageLog/>      from store.eventLog (empty for now is fine)
</GameScreen>
```

At 1280×720 everything is visible with no scrolling. Under ~1024 px, stack as
described; nothing essential hidden (ALT-09-1).

Wrap the screen in an **error boundary** that shows "Something went wrong —
your game is safe" and a Resync button, instead of a blank page (NFR-SYS-03).

## BoardGrid
15×15 CSS grid built from `src/config/board.ts`. Never a second copy of the
coordinates.
- Four 6×6 bases, each with 4 slots.
- 52 track cells; each colour's start square tinted.
- Safe squares from **`snapshot.rules.safeSquares`** — star icon + accessible
  label. Not a constant.
- Home columns, centre, and entry arrows.

## PieceLayer
`{ pieces, safeSquares }` → one `<Piece>` per piece at `pieceCell()`
(percent positioning). Key by `piece.id`. Stacks use `stackOffsets`. Framer
Motion `layout` for a smooth tween (the real walk is P8).

## StatusPanel (FR-SYS-06)
One `PlayerCard` per player, in turn order: mark, name, tag, and
**Base · Track · Home** from `selectProgress`. Active player highlighted.
Dev-only check: `home` equals `player.piecesHome`; log loudly if not.

## Rules button
`?` opens `RulesSummary` with **`snapshot.rules`** (not `defaultRules`).

## Fixtures
Dev-only `?fixture=<name>` loads a snapshot from `src/mock/fixtures.ts`:
`start`, `spread`, `stacked`, `homeRun`, `edges` (step 1 and 51 for every
colour), `twoPlayer` (opposite corners, R1).

## Prove NFR-SYS-11
Use the mock's `POST /debug/rules` to change `safeSquares` and
`bonusOnCapture`, start a match, and confirm the stars move and the rules
summary text changes — with **no code change**. Screenshot both states to
`docs/evidence/NFR-SYS-11-*.png`.

## Done when
Every fixture renders correctly — for `edges`, report colour by colour that
step 51 sits next to its own home column. Status counts match the fixture.
Screenshots at 1024, 1366 and 1920 wide saved to `docs/evidence/` (NFR-SYS-10).
Both themes look right.
Update traceability rows FR-SYS-09, FR-SYS-06 (counts), NFR-SYS-10, NFR-SYS-11.
