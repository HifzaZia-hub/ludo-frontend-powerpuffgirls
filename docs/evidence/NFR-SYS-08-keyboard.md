# Keyboard-only game and wording review (NFR-SYS-08)

Run on 2026-11-16 with `npm run e2e -- keyboard --fast` in Chrome 157 and Firefox 160 (both
headless) against the mock server. The script sends key presses only. It never sends a mouse event
in this mode. A move counts only once the list of moves closes, so a press that did nothing can't
pass as a move.

## The whole flow, by keyboard alone

| Step | Keys | Result |
|---|---|---|
| Main screen → New game | Tab to New Game, Enter | Setup screen |
| Choose the game type | Tab to the game type, arrow keys | "Play with friends" chosen |
| Name and start | Tab to the name, type, Tab to Start, Enter | Waiting room |
| Fill empty seats | Tab to the switch, Space | Switched from off to on |
| Start the game | Tab to Start game, Enter | Board |
| Roll, choose and move | R, then a number key, Tab to a piece or Tab to a move, then Enter | 3 moves made |
| Restart | Shift+Tab to Menu, Enter, Tab to Restart, Enter | The question opened with **Cancel** focused |
| Confirm the restart | Tab to Restart, Enter | New match, every piece back in base |
| A whole game | R, number keys, Tab and Enter | Chrome: 135 rolls and 124 moves to "Rida wins!" in 235 s. Firefox: 110 rolls and 81 moves to "Computer 3 wins!" in 160 s |
| Play again | Tab to Play again, Enter | New match |
| Leave, then Cancel | Menu, Leave game, Enter on the focused Cancel | Question closed, game kept |
| Leave | Menu, Leave game, Tab to Leave, Enter | Main screen |

In both browsers every step passed, every choice of a piece selected exactly what was pressed, no
move press was missed, and there were no console errors.

The game type step chose "Play with friends", because only a game with friends has a waiting room.
The mock starts a game against the computer straight away. The empty seats were filled with computer
players, so it was still a game against the computer.

## Wording review of `src/feedback/copy.ts` and `src/feedback/messages.ts`

`messages.ts` builds its sentences only from the `MESSAGES` templates in `copy.ts`, so the review
covers `copy.ts`. Each string was checked for length, technical words, error codes and blame.

- **No codes reach the player.** Server error codes are mapped to sentences, and any code we don't
  know gets "That didn't work. Try again."
- **No blame.** Refusals say what to do next: "Wait for your turn.", "Roll the dice first.", "You
  already rolled. Pick a piece to move."
- **Short.** Of the 218 strings, all but one have 17 words or fewer, counted by a script. The
  longest is a rules line: "Land on another player's piece to send it back to base, except on the
  4 safe squares." Most errors are under 12 words.
- **One long text, on purpose.** The dice check's explanation is 39 words, in three short sentences.
  It only shows when someone presses "Check the dice were fair", for players like Hamza (D2) who
  want to know how it works.
- **Words a 12-year-old may not know**, kept because each is explained or common in games: "session"
  in "Your game session ended. Please start again.", and "safe square" (marked with a star and
  explained in the rules).

Nothing was changed. No string failed the review.

## Rerun

```
npm run e2e -- keyboard --fast
npm run e2e -- keyboard --fast --browser firefox
```
