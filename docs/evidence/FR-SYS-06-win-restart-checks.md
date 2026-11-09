# Win screen, restart, leave and session score checks (P10)

Run on 2026-11-09 in headless Edge, using the real app and the mock server (`mock-server --debug`
unless noted). The two-player checks used two browser tabs: Rida as host and Hamza as a guest, with
2 computer players.

## The winner and the ranking (FR-SYS-06)

The mock's `near-win` scenario, played to the end.

| | Host (Rida) | Guest (Hamza) |
|---|---|---|
| Heading | "Rida wins!" | "Rida wins!" |
| Final places, in the server's order | 2. Hamza, 3. Computer 3, 4. Computer 4 | The same |
| Wins this session | Rida 1, everyone else 0 | The same |
| Play again | Offered | Not offered: "Waiting for Rida to start a new game." |
| Confetti | Shown | Shown |

`FR-SYS-06-win-screen.png`, `FR-SYS-06-waiting-for-host.png`, `FR-SYS-10-win-light.png`,
`NFR-SYS-07-win-grayscale.png`.

The screen appeared only after the winning move had finished playing. The ranking appears because
the server sent it.

**Dice check:** "✓ They match. The dice weren't changed during this game." `FR-SYS-06-dice-check.png`.

## Session score and rematch (D2 FR-29)

After Play again, both tabs went back to the game with every player on 4 / 0 / 0 and an empty
message log. Rida's card showed "1 win". After winning the rematch, the score read "Rida: 2 wins".

## Restart and leave (FR-SYS-08)

- **Who sees what:** the host's menu has Restart and Leave game. The guest's has only Leave game.
- **Restart, then Cancel:** the dialog said "Restart the game?" with focus on Cancel. Cancel closed
  it, the board was identical and focus went back to Menu (POST-08-1). `FR-SYS-08-restart-confirm.png`.
- **Restart, then Esc:** the same.
- **Restart, confirmed:** a board with pieces out of base reset to 4 / 0 / 0 for every player in both
  tabs, and the old log was gone. "This game was stopped" never appeared.
- **New game:** went to setup with the name and game type filled in from the last game.
- **When the host left:** the guest became host and was offered Play again.
- **Main menu:** went to the main screen.

## By keyboard alone (NFR-SYS-08)

- Menu, then Leave game, then the dialog with focus on Cancel. Enter on Cancel closed it and put
  focus back on Menu. Then Leave game again, Tab to Leave, Enter: back on the main screen.
- A finishing move by `R`, a number and Enter. The win screen arrived with focus on "Rida wins!".
  Tab reached Play again, the dice check (opened with Enter) and Main menu (which left the game).

## Whole games and other checks

| | Mouse | Keyboard only |
|---|---|---|
| Rolls | 110 | 72 |
| Moves | 97 | 65 |
| Result | Rida got 4 pieces home | Computer 3 got 4 pieces home |
| Console errors or error messages | None | None |

Both games used computer delay 30 ms and no turn timer, and a script played them. In the mouse game a
piece was covered twice at the moment of the click, by a piece passing over it, and the matching
card was used instead.

- **Your exact setup:** `npm run mock` and `npm run dev` with default rules and no debug routes: 7
  rolls and 6 moves with no console errors.
- **Window sizes (NFR-SYS-10):** the win screen fits with no page scrolling at 1280×720 and 1024×768.
  At 360×640 the page scrolls down but not sideways.

## Not checked here

These are proved by tests only:

- "This game was stopped". The mock only sends `GAME_ABANDONED` once no human is connected, so nobody
  is left to see it. `src/interaction/useAppNavigation.test.ts` also proves a restart that sends it
  first (as the real server will) never shows that screen.
- A restart or leave the server refuses (POST-08-3), and Play again resting for 5 seconds.
- `SHOW_SESSION_SCORE` being switched off, and a game with no `ranking` sent.

Also:

- The confetti check only confirms it drew. The dice check uses the mock's way of making the code, and
  the contract doesn't say the real server does the same (`docs/01-contract.md` §8).
- Only Edge and the mock have been tried.
