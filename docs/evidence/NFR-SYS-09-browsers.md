# Browser smoke test (NFR-SYS-09)

The smoke test starts a game against the computer, rolls, moves twice, then wins and checks the win
screen. The win uses the mock's debug scenario `near-win`, so it doesn't take a whole game.

| Browser | Version | How | Start | Roll | Move | Win | Console errors | Date |
|---|---|---|---|---|---|---|---|---|
| Chrome | 157.0.8103.51 | `npm run e2e -- smoke --browser chrome` | ✓ | ✓ | ✓ | ✓ | 0 | 2026-11-15 |
| Edge | 157.0.4341.46 | `npm run e2e -- smoke --browser edge` | ✓ | ✓ | ✓ | ✓ | 0 | 2026-11-15 |
| Firefox | — | **not run yet** | | | | | | |

Both runs used headless browsers on Windows 11 against the dev server. Every other P12 check (the
keyboard game, five full games, sizes, grayscale, contrast and timing) also ran in Chrome, and every
check from P6 to P11 ran in Edge.

## Firefox

Firefox isn't installed on the machine used for these checks. The script can't drive it either: it
uses the Chrome DevTools Protocol, and Firefox no longer supports that. Playwright could, but it isn't
in our locked stack (CLAUDE.md §2).

To finish this row by hand, with the latest Firefox:

1. Run `npm run mock:debug` and `npm run dev`, and open `http://localhost:5173` in Firefox.
2. **Start:** New Game, "Play with computer", type a name, Start. The board appears.
3. **Roll and move:** press Roll (or R). When you can move, pick a piece and press Move. Do it twice.
4. **Win:** a game against the computer has no waiting room, so get its code from the console (F12):
   `JSON.parse(sessionStorage['ludo-session']).roomCode`. When it is your turn to roll, run this in
   another terminal with your code in place of `ABC234`:

   ```
   curl -X POST http://localhost:3001/debug/scenario -H "content-type: application/json" -d "{\"roomCode\":\"ABC234\",\"name\":\"near-win\"}"
   ```

   Then roll and move the piece that can reach home. The win screen appears.
5. Check the console (F12) for red errors, and fill in the Firefox row above with the version from
   Help → About Firefox.
