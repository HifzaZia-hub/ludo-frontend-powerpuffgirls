# Invalid input never loses state (NFR-SYS-04)

## The store tests from P3 onwards

Run on 2026-11-15:

```
npx vitest run src/store/gameStore.test.ts src/adapter/LgsAdapter.test.ts

 ✓ src/adapter/LgsAdapter.test.ts (20 tests)
 ✓ src/store/gameStore.test.ts (128 tests)
 Test Files  2 passed (2)
      Tests  148 passed (148)
```

The tests that matter most here:

- "leaves the snapshot deep-equal after a rejected move"
- "keeps state, clears pending and tells the player after a timed-out command"
- "keeps v5 when v4 arrives after it" (an older snapshot is dropped)
- "keeps the board through a lost connection"
- "shows friendly copy and syncs on a stale-state code"
- "keeps everything when a leave fails" and "keeps the game and explains when the server refuses"
- In the adapter: "passes on a rejection unchanged", "resolves to INTERNAL_ERROR when the server
  never answers" and "resolves to INTERNAL_ERROR on an incomplete ack"

## Fast presses and invalid moves in a real browser

Run with `npm run e2e -- invalid` in Chrome 157 (headless), in a game against the computer. The
script counted every message the page sent to the server, on both of socket.io's transports.

| What was done | Expected | Result |
|---|---|---|
| Clicked the die 10 times as fast as possible | 1 roll sent | ✓ 1 |
| With only piece 1 able to move, pressed 2, 3 and 4 | nothing sent, nothing changes | ✓ |
| Pressed R after rolling | nothing sent | ✓ |
| Clicked another player's piece | nothing sent | ✓ |
| After all of that | board and choices unchanged | ✓ |
| Picked the piece, then pressed Enter 3 times fast | 1 move sent | ✓ 1 |
| Pressed R, 1, 2 and Enter during a computer's turn | nothing sent | ✓ |
| Pressed R 10 times fast on my next turn | 1 roll sent | ✓ 1 |

No error screen and no console errors.

A move the **server** refuses can't be made from the real screen, because it only offers the server's
legal moves. That case is proved by the tests above, and on the game screen by
`src/screens/GameScreen.test.tsx` (FR-SYS-04).

## Rerun

```
npm run e2e -- invalid
```
