# Browser smoke test (NFR-SYS-09)

The smoke test starts a game against the computer, rolls, moves twice, then wins and checks the win
screen. The win uses the mock's debug scenario `near-win`, so it doesn't take a whole game.

| Browser | Version | How | Start | Roll | Move | Win | Console errors | Date |
|---|---|---|---|---|---|---|---|---|
| Chrome | 157.0.8103.51 | `npm run e2e -- smoke --browser chrome` | ✓ | ✓ | ✓ | ✓ | 0 | 2026-11-15 |
| Edge | 157.0.4341.46 | `npm run e2e -- smoke --browser edge` | ✓ | ✓ | ✓ | ✓ | 0 | 2026-11-15 |
| Firefox | 160.0 | `npm run e2e -- smoke --browser firefox` | ✓ | ✓ | ✓ | ✓ | 0 | 2026-11-15 |

All three ran headless on Windows 11 against the dev server. Every other P12 check (five full games,
sizes, grayscale, contrast and timing) also ran in Chrome, and every check from P6 to P11 ran in Edge.

## More in Firefox

Beyond the smoke test, these ran in Firefox 160.0 on 2026-11-16, all passing:

- **A whole game by keyboard alone** (`keyboard --fast`): setup, the waiting room, restart, a full
  game to "Computer 3 wins!" (110 rolls, 81 moves), Play again, Cancel and leave. No console errors.
- **Invalid input** (`invalid`): ten fast clicks send one roll, keys for pieces that can't move send
  nothing, and Enter pressed three times sends one move.
- **The error screen** (`boundary`): a board that can't be drawn shows "Something went wrong — your
  game is safe" with Try again.

## How Firefox is driven

Firefox no longer supports the Chrome DevTools Protocol, so the script drives it with WebDriver BiDi,
the standard protocol Firefox supports, over a plain WebSocket. It still needs no extra library.
`grayscale` and `perf` need Chrome or Edge, because they use DevTools-only vision emulation and
tracing.

One quirk of **headless** Firefox: if Tab goes past the end of the page, focus passes through the
browser's invisible toolbar and the page never gets it back, so Enter and Space stop pressing
buttons. A tiny page with none of our code does the same, so it is the test setup, not the app. A
real Firefox window gives the page its focus back. The script avoids it by tabbing towards a control
without passing either end of the page, and stops with a clear message if Tab ever leaves the page.
