# No crash in normal play (NFR-SYS-03)

## Five full games in a row, on the production build

Run on 2026-11-15 with `npm run e2e -- games --count 5 --fast --build` in Chrome 157 (headless). The
script built the app, served it with `vite preview`, and played five games against three computer
players in one tab, starting each new game with "Play again". It played my turns with a mix of the
mouse (die, list of moves, Move button) and the keyboard (R, number keys, Enter). The computer waited
30 ms instead of 700 ms, so the five games took 13 minutes instead of over an hour.

| Game | Winner | Time | My rolls | My moves | Error screen |
|---|---|---|---|---|---|
| 1 | Computer 3 | 158 s | 91 | 43 | no |
| 2 | Computer 3 | 192 s | 121 | 88 | no |
| 3 | Computer 4 | 162 s | 110 | 73 | no |
| 4 | Computer 2 | 86 s | 65 | 48 | no |
| 5 | Computer 4 | 168 s | 101 | 71 | no |

All five reached the win screen. The error screen never appeared, and the console had **no errors**.

Other whole games on the P12 code, also with no error screen and no console errors:

- Two played by keyboard alone, from the main screen to a winner: one in Chrome and one in Firefox
  (`NFR-SYS-08-keyboard.md`).
- One at the default speed, for the computer timings (`NFR-SYS-02-ai-times.md`).

## The error screen, forced in a real browser

`npm run e2e -- boundary` opens the dev-only fixture `?fixture=broken`, whose snapshot has a piece on
step 99. The board can't draw it and throws. The error boundary caught it and showed "Something went
wrong — your game is safe" with a Try again button, instead of a blank page.
`NFR-SYS-03-error-boundary.png`. React reports the error it caught to the console, which is expected
in a dev build. The fixture isn't in the production build.

Every screen has its own error boundary (P11). The tests in `src/App.test.tsx` and
`src/components/ErrorBoundary.test.tsx` prove the same for the game screen and the waiting room.

## Rerun

```
npm run e2e -- games --count 5 --fast --build
npm run e2e -- boundary
```
