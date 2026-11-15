# Computer move within 2 s (NFR-SYS-02)

Run on 2026-11-15 with `npm run e2e -- games --count 1` in Chrome 157 (headless) on the dev server,
against the mock with its **default rules**: the computer waits 700 ms, and each turn has a 30-second
timer. One whole game, me against three computer players, to the end ("Rida wins!", 311 s).

## How it was measured

`src/feedback/aiTimings.ts` runs in dev builds only. It writes a console line for each computer turn,
from the snapshot that asks the computer to roll to the next snapshot that waits for a roll, which is
when its move has arrived. An extra turn after a 6 counts as a turn of its own. It only reads
snapshots, so it can't change the game. `src/feedback/aiTimings.test.ts` covers it.

## Results

| | |
|---|---|
| Computer turns timed | 169 |
| Fastest | 1,384 ms |
| Median | 1,416 ms |
| Slowest | **1,733 ms** |
| Over 2 s | **0** |

The mock waits 700 ms before the computer rolls and 700 ms again before it moves, so about 1,400 ms of
every turn is that deliberate pause. The rest is the network and the browser.

## Not measured

- The time is when the move **arrives**. Animations On then walk the piece, at 120 ms a square, which
  the player sees after that.
- This is the mock. The backend team's server may take a different time, and the same log will show
  it in a dev build.
- One laptop, with the browser and the server on the same machine.

## Rerun

```
npm run e2e -- games --count 1
```
