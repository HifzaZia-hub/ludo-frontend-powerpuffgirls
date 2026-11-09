# Move choice, walking and skip checks (P8)

Run on 2026-11-09 in headless Edge, using the real app and the mock server. Each match had one
person and 3 computer players. All results below are from the final code.

## A whole game by mouse and by keyboard

Both games ran against `mock-server --debug` with the computers' delay set to 30 ms and no turn
timer, so that nobody else could play the person's turns. Animations were On. No move was forced.

| | Mouse | Keyboard only |
|---|---|---|
| How the game was set up | Mouse | Keyboard, from the main screen to the first roll |
| Rolls | 63 | 119 |
| Moves | 50 | 95 |
| Ways of choosing used | Piece twice, piece then Move, card twice | `1`–`4` then Enter (32), Tab to a piece then Enter (32), Tab to a card then Enter (31) |
| Result | Computer 4 got 4 pieces home | Computer 3 got 4 pieces home |
| A first press sent a move, or was lost | 0 | 0 |
| Console errors or error messages | None | None |
| Pieces off their square at the end | 0.002% of the board | 0.002% of the board |

A computer won both games, so the person's own winning move is covered by the Animations check
below. `FR-SYS-03-mouse-game-finished.png` shows the end of the mouse game.

A third, shorter run used the mock with no debug routes and its default rules: 16 rolls and 6 moves
with no console errors.

## Choosing a move (FR-SYS-03)

- A forced 6 at the start offered exactly the 4 pieces the server listed. The other 12 were dimmed
  and could not be pressed (POST-03-1). `FR-SYS-03-four-options-1280x720.png`.
- The first click chose the piece and sent nothing. The destination marker was 0.000% from where
  the server's `toStep` says. `FR-SYS-03-piece-chosen.png`.
- `Esc` cleared the choice and the marker.
- The mock's `capture-ready` scenario listed "Piece 1 → move 1 square and capture Computer 2's
  piece", and choosing it put a dashed red ring on the piece that would be captured. Its label read
  "Green piece 1, on the track, would be captured". After the move, that piece was back in its
  base. `FR-SYS-03-capture-preview.png`.
- The mock's `no-legal-move` scenario showed "Rida can't move. Turn skipped." with no chooser.
- The chooser appears only after the die has landed.

## Walking and skipping (FR-SYS-05)

| Check | Result |
|---|---|
| A walk of 6 squares, Animations On | Reached each square in order, at 157, 291, 424, 557, 717 and 841 ms after the click |
| Skip with `S`, on a 5-square walk that takes 600 ms | Pressed at about 221 ms, on its final square at 259 ms. `FR-SYS-05-skip-during-walk.png` |
| Interrupted: a computer's snapshot arrives 150 ms into a 5-square walk | On its final square at 451 ms, 0.000% from where the snapshot says |
| The same last move with Animations Off and On (POST-05-2) | Off passed through no squares and On passed through each one. All 16 pieces ended in identical places |

## Other checks

- **Window sizes (FR-SYS-09, NFR-SYS-10), with the longest list of 4 moves:** no page scrolling and
  every part in view at 1280×720, 1024×768, 1366×768 and 1920×1080, and no sideways scrolling at
  800 and 360 px wide. The message card is smallest at 1024×768, at 82 px tall.
- **Not colour alone (NFR-SYS-07):** `NFR-SYS-07-move-highlights-grayscale.png` and
  `NFR-SYS-07-capture-grayscale.png`.
- **Light theme (FR-SYS-10):** `FR-SYS-10-choosing-light.png`.

## Not checked here

- These are proved by tests only, because the real screen never offers such a press and the mock
  can't be told to refuse one: an illegal move, a piece that is no longer legal (EXC-03-1), a reply
  with no reason (ALT-04-1), retrying after a failure (EXC-04-1), and the reply arriving before the
  new state.
- `rules.autoMoveSingleOption` is proved by tests only.
- Only Edge and the mock have been tried. Each game was played by a script, not a person.
- The windows were measured at the sizes above, not on real phones or tablets.
