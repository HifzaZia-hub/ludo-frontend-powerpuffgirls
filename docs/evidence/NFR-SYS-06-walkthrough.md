# Expert walkthrough of a first turn (NFR-SYS-06)

**This is not the hallway test.** NFR-SYS-06 asks for someone who has never seen the app to play a
first turn alone. That still needs a real person: see `NFR-SYS-06-first-use.md`. This walkthrough was
done on 2026-11-16 by Claude (the AI assistant that built most of the front end), going through the
app step by step as a newcomer would and noting every place that could confuse one. It finds likely
problems early. It can't show what a real first-timer does.

Run in headless Edge against the mock, with screenshots at each step. A newcomer's first roll was set
to 3 and their next to 6, through the mock's debug route, so both cases could be seen.

## The steps

| Step | What the player sees | Could it confuse a newcomer? |
|---|---|---|
| Main screen | LUDO, "Roll · Move · Capture · Win", New Game, Join Game, How to play, Settings | No. New Game is first and largest. |
| How to play | 9 short rules, including "Roll a 6 to bring a piece out of base.", and the keyboard keys | No. But a newcomer may skip it. |
| Setup | 4 players, "Play with computer" and Normal already chosen; a name box; "You will be R Red"; Start | No. Only the name is needed. |
| Game starts | "Your turn — roll the dice", a big die marked Roll, "Game started. Sam goes first." | No. |
| First roll is a 3 | "No move possible — turn skipped", the log says "Sam can't move. Turn skipped.", and the turn moves on | **Yes, likely.** Nothing says *why*: you need a 6 to bring a piece out. It's only in How to play. This happens on 5 first rolls in 6. |
| Next turn, a 6 | "Your turn — pick a piece", the four pieces are highlighted, and a list says "Piece 1 → come out of base" for each | No. |
| A piece is picked | The piece and its list entry are marked, a dashed ring shows where it will go, and Move turns bright | **Yes, possibly.** The top line still said "pick a piece", so a newcomer might wait for the piece to move by itself. **Fixed:** it now says "Your turn — now press Move". |
| After the move | "Sam rolled 6 and brought a piece out.", "Sam rolls again!", "Your turn — roll the dice" | No. |
| All along | A ring counts down from 30 under the die | **Maybe.** It shows only a number. How to play says "You have 30 seconds for each turn." |

No console errors at any step.

## What was done about it

- **Fixed:** after a piece is picked, the turn line says "Your turn — now press Move" and goes back to
  "pick a piece" if the choice is cancelled. `src/screens/GameScreen.test.tsx` covers it.
- **Needs the team's decision, not built:** when a newcomer's turn is skipped, the reason could be
  shown ("You need a 6 to bring a piece out"). That means the app explaining a game rule, and the
  server's rules say nothing about which roll brings a piece out, so CLAUDE.md §1 says to ask first.
  A rule-free option is to point to How to play the first time a turn is skipped.
- **Left as is:** the countdown's bare number. It's explained in How to play, and the hallway test
  will show whether anyone is confused by it.

## What the hallway test should watch for

The first two rows marked "Yes": whether the newcomer understands a skipped turn, and whether they
find Move after picking a piece.
