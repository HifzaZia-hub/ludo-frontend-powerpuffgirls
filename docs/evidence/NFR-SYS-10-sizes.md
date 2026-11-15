# Window sizes (NFR-SYS-10)

Run on 2026-11-15 with `npm run e2e -- sizes --save` in Chrome 157 (headless). At each size the
script checked whether the page scrolls sideways or is taller than the window, and whether any
button, field or link is outside the window. On the game screen it checked that the top bar, board,
player cards, die, message log and list of moves are each fully in view, with a move waiting to be
picked so the list is filled in.

| Screen | 1024×768 | 1366×768 | 1920×1080 |
|---|---|---|---|
| Main | ✓ | ✓ | ✓ |
| Setup | ✓ | ✓ | ✓ |
| Waiting room | ✓ | ✓ | ✓ |
| Game | ✓ | ✓ | ✓ |

✓ means no scrolling in either direction and nothing out of view. Screenshots:
`NFR-SYS-10-<screen>-<width>x<height>.png`, for example `NFR-SYS-10-game-1024x768.png`.

The win screen was measured in P10 (`FR-SYS-06-win-restart-checks.md`), and the game screen with a
full message log in P9 (`FR-SYS-05-event-checks.md`).

Phones are TO CONFIRM (`00-requirements.md` §5) and weren't checked.
