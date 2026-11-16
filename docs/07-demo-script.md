# 07 — Demo script

A run-through for showing the front end, about 10 minutes. Every step uses the real app against the
mock server.

## Before the demo (15 minutes ahead)

1. **Plug the laptop in.** On battery, Windows puts it to sleep a few minutes after the screen goes
   idle, and that drops the game.
2. Get the latest code: `git switch main` then `git pull`.
3. In VS Code, open two terminals and start the servers:
   - `npm.cmd run mock:debug` (debug mode, so step 8 can force a quick win)
   - `npm.cmd run dev`
   Use `npm.cmd`, because PowerShell blocks plain `npm` on this laptop.
4. In a third terminal, run `npm.cmd run e2e -- smoke`. It plays a quick game in a hidden Chrome on
   its own ports and should end with **PASSED**.
5. Open http://localhost:5173 in Chrome at 100% zoom, and close other tabs.

## The demo

1. **Main screen → How to play.** The rules text is built from the rules the server sends, so it
   always matches what the server does (NFR-SYS-11).
2. **New Game → "Play with computer" → type a name → Start.** It's me against three computers.
3. **Play a few turns with the mouse.** Point out:
   - the turn line at the top;
   - the highlighted pieces and the list of moves;
   - "Your turn — now press Move" after picking a piece;
   - the message log;
   - the player cards counting Base, Track and Home;
   - "Computer is thinking…" during the computers' turns.
4. **Switch to the keyboard:** R rolls, 1–4 picks a piece, Enter moves, ? opens the rules
   (NFR-SYS-08).
5. **Refresh the page (F5) mid-game.** "Rejoining your game…", then the same board and turn
   (NFR-SYS-04).
6. **Settings:**
   - switch to the light theme;
   - set animations to Off, then Fast;
   - turn the sound off.
   The board stays exactly as it was (FR-SYS-10).
7. **Not by colour alone:** DevTools (F12) → ⋮ → More tools → Rendering → "Emulate vision
   deficiencies" → Achromatopsia. Players are still told apart by letter and shape (NFR-SYS-07).
   Turn it back off.
8. **A quick win:**
   - Wait until it's your turn to roll.
   - In the console, get the game code with `JSON.parse(sessionStorage['ludo-session']).roomCode`.
   - In a terminal, run the line below with that code in place of `ABC234`.
   - Then roll, and move the piece that can reach home.

   ```
   curl -X POST http://localhost:3001/debug/scenario -H "content-type: application/json" -d "{\"roomCode\":\"ABC234\",\"name\":\"near-win\"}"
   ```

   On the win screen, show the final places, the session score and "Check the dice were fair".
9. **Play again, then Menu → Leave game.** The confirm dialog opens with Cancel focused, so nothing
   is lost by accident (FR-SYS-08).
10. **The evidence:** `docs/05-traceability.md` maps every requirement to its proof, and
    `docs/evidence/` holds the screenshots and notes.

## If something goes wrong

| What happens | What to do |
|---|---|
| "Reconnecting…" stays up | The mock stopped. Restart it with `npm.cmd run mock:debug`. It forgets games when it stops, so the app says the session ended. Start a new game |
| A blank page, or an old version | Refresh with Ctrl+F5 |
| "This game is open in another tab." | Close the other tab, or press "Play here instead" |
| A screen shows "Something went wrong — your game is safe" | Press Try again |
| `npm` says scripts are disabled | Use `npm.cmd` instead of `npm` |
