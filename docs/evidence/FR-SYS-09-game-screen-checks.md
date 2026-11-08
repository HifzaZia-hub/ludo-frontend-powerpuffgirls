# Game screen checks (P6)

Run on 2026-11-08 in headless Edge, using the real app and the mock server (`mock-server --debug`).
Fixtures are the dev-only `?fixture=<name>` snapshots in `src/mock/fixtures.ts`.

## One screen, every window size (FR-SYS-09, NFR-SYS-10)

Measured with the `spread` fixture: page scroll, and whether the top bar, board, players, dice and
messages are each fully inside the window.

| Window | Page scrolls? | All parts in view? | Board (square) | Screenshot |
|---|---|---|---|---|
| 1280×720 | No | Yes | 651 px | `FR-SYS-09-one-screen-1280x720.png` |
| 1024×768 | No | Yes | 544 px | `NFR-SYS-10-1024-wide.png` |
| 1366×768 | No | Yes | 699 px | `NFR-SYS-10-1366-wide.png` |
| 1920×1080 | No | Yes | 1011 px | `NFR-SYS-10-1920-wide.png` |

Under 1024 px (ALT-09-1) the board goes on top, then dice and players in one row, then messages.
Checked at 1000×700, 800×600 and 360×640: no sideways scrolling and nothing hidden. The page
scrolls down at these sizes, which is expected.

## Fixtures

All six draw every piece. Base, Track and Home on each card match the written-out numbers in
`src/screens/GameScreen.test.tsx`.

`edges` puts each colour's pieces on steps 1 and 51. Step 51 sits next to that colour's own home
column:

| Colour | Step 51 cell | First home column cell |
|---|---|---|
| Red | [0,7] | [1,7] |
| Green | [7,0] | [7,1] |
| Yellow | [14,7] | [13,7] |
| Blue | [7,14] | [7,13] |

## Rules come from the server (NFR-SYS-11, D2 FR-07)

`POST /debug/rules` changed the room's rules in the lobby. No code changed between the two runs.

| | Default rules | After the change |
|---|---|---|
| `safeSquares` | 0, 8, 13, 21, 26, 34, 39, 47 | 2, 15, 28, 41 |
| Stars drawn on | 0, 8, 13, 21, 26, 34, 39, 47 | 2, 15, 28, 41 |
| Rules text, safe squares | "except on the 8 safe squares" | "except on the 4 safe squares" |
| "Capturing a piece gives you another turn." | Shown | Gone (`bonusOnCapture: false`) |
| Screenshots | `NFR-SYS-11-default-board.png`, `NFR-SYS-11-default-rules.png` | `NFR-SYS-11-changed-board.png`, `NFR-SYS-11-changed-rules.png` |

## Real matches against the mock

- **Seats and modes (FR-SYS-01):** computer games with 2, 3 and 4 seats and friends games with 2,
  3 and 4 seats all reached the board, with four pieces per player and one card per player.
- **Live match (FR-SYS-06, FR-SYS-07):** with a 10-second turn timer, a computer player's piece
  moved from a server snapshot (`FR-SYS-07-computer-move-from-snapshot.png`).
  Each card's counts matched the pieces on the board. The piece elements stayed the same ones, so
  nothing was re-created.
- **Position:** after the move and after resizing the window to 1024 wide, every piece was 0 px
  from the spot its snapshot gives.
- **Console:** no errors in any run, so the dev-only home count check stayed quiet.

## Other checks

- **Keyboard (NFR-SYS-08):** Tab goes Rules, Settings, Sound, and since P7 the die. Menu is skipped
  because it is disabled until P10. `?` opens the rules and Esc closes them.
- **Grayscale (NFR-SYS-07):** `NFR-SYS-07-board-grayscale.png`. Shapes still tell the four players
  apart on pieces, yards and home columns.
- **Light theme (FR-SYS-10):** `FR-SYS-10-game-light.png`.

## Not checked here

- The crash screen (NFR-SYS-03) is proved by `src/App.test.tsx` and
  `src/components/ErrorBoundary.test.tsx` only. A real browser run needs a broken snapshot, and the
  mock can't send one.
- Firefox and Chrome are for P12.
