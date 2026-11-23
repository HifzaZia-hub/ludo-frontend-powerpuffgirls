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

## The front page fits the window (2026-11-22)

The front page used to need 747 px of height whatever the window, so it scrolled in most laptop
browsers: a 1366×768 or 1280×720 screen leaves only about 600 to 660 px once the browser's own bars
are counted. Now its die, title, pawns and gaps follow the window's height (`.front-page` in
`src/styles/theme.css`), so it fits from a short window up to a big screen, where it grows to fill
the space. Below 600 px tall, or under 760 px on a phone, the feature strip steps aside so the
buttons still fit. `npm run e2e -- sizes` now fails if the front page scrolls at any of these:

| Window | Before | After |
|---|---|---|
| 1920×1080 | fits, content small | fits, die 112 → 135 px, title 96 → 91 px |
| 1536×730 | scrolls (747 px) | fits |
| 1366×768 | fits | fits |
| 1366×657 | scrolls (747 px) | fits, with the feature strip |
| 1280×720 | scrolls (747 px) | fits |
| 1280×600 | scrolls (747 px) | fits, with the feature strip |
| 1280×480 | scrolls | fits, strip hidden |
| 1024×768 | fits | fits |
| 390×844 (phone) | fits | fits |
| 360×640 (phone) | scrolls | fits, strip hidden |

Screenshots: `NFR-SYS-10-main-1366x657.png` and `NFR-SYS-10-main-390x667.png`, and the three
`NFR-SYS-10-main-*.png` above, retaken. A page zoomed in the browser may still scroll, which WCAG
allows; the sizes keep their minimums so zoomed text still grows.
