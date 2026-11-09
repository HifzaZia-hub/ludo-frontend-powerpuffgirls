# Event feedback, message log and sound checks (P9)

Run on 2026-11-09 in headless Edge, using the real app and the mock server. Each match had one
person and 3 computer players. The sounds are placeholder tones.

## A capture plays in order (FR-SYS-05, the task's done-when)

The mock's `capture-ready` scenario, with Animations and Sound on. Times are from the click that
sent the move.

| Time | What happened |
|---|---|
| 42 ms | The new snapshot arrives, the piece starts walking and Skip appears |
| 169 ms | The captured piece flashes and shakes. The log line becomes "Rida rolled 1 and captured Computer 2's piece!" |
| 334 ms | The flash ends and the piece starts back to its base |
| 754 ms | It has arrived. "Roll again!" appears, the log adds "Rida rolls again!", and Skip goes away |
| 1767 ms | The banner goes away |

Each step started only after the one before it had finished.

**Sounds:** the browser's audio calls show `roll`, `move`, `capture`, in that order. The sound file
was not loaded until after the first press. `FR-SYS-05-roll-again.png`.

## Same run with Animations and Sound off (POST-05-2, POST-10-2)

The board and the log matched the run above exactly. The capture effect never showed, no sound
played, and the sound file was never loaded.

## The log reads like a story (D2 FR-36)

- The end of a whole game: "Computer 2 wins!", "Computer 2 rolled 1 and got a piece home!", "Rida
  rolled 1 and moved a piece.", "Computer 4 rolled 5 and moved a piece.", "Computer 4 rolls again!"
  `FR-SYS-05-message-log.png` shows it during a game with 4 moves open.
- `no-legal-move`: "Rida rolled 3." then "Rida can't move. Turn skipped.", with the banner "No move
  possible — turn skipped". `FR-SYS-05-turn-skipped.png`.
- `three-sixes`: "Rida rolled 6." then "Three 6s in a row — Rida's turn is over.", and the sixes
  pips flashed.
- `near-win`: the winning move still played. The piece reached home and glowed at 446 ms, and "Rida
  wins!" appeared at 864 ms.

## Skip (D2 FR-38)

`S` was pressed at 219 ms, during the capture flash. By 233 ms the effect had ended, Skip had gone
and the log had its final line. Every piece was on its exact square.

## Settings changed during a real game (FR-SYS-10)

Sound, theme and animation speed were each changed and changed back. The board and the log were
identical before and after (POST-10-2, POST-10-3).

## Whole games and other checks

| | Mouse | Keyboard only |
|---|---|---|
| Rolls | 69 | 115 |
| Moves | 49 | 75 |
| Result | Computer 2 got 4 pieces home | Computer 3 got 4 pieces home |
| Console errors or error messages | None | None |
| Pieces off their square at the end | 0.002% of the board | 0.002% of the board |

Both games used `mock-server --debug` with the computers' delay set to 30 ms and no turn timer. A
script played them, and Animations were On.

- **Your exact setup:** `npm run mock` and `npm run dev`, with default rules and no debug routes: 10
  rolls and 6 moves with no console errors, and the log read correctly.
- **Window sizes (FR-SYS-09, NFR-SYS-10):** with a full log there was no page scrolling and every
  part stayed in view at 1280×720 and 1024×768. Long logs scroll inside their own card.

## Not checked here

- The bump on the Home count is proved by `src/screens/GameScreen.test.tsx`, not measured in a real
  match.
- Only Edge and the mock have been tried, and the audio check counts what the page asked the browser
  to play. Nobody has listened to it.
- A computer's own capture was not forced in a real match. That a computer's next roll doesn't cut
  it short is proved by `src/feedback/useEventFeedback.test.ts`.
- The last change, scrollbar colour in each theme, came after the event checks above. One more whole
  game by mouse ran after it (the table above).
