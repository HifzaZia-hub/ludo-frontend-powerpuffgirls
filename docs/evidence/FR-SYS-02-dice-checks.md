# Dice and turn checks (P7)

Run on 2026-11-09 in headless Edge, using the real app and the mock server (`mock-server --debug`).
The match had one person and 3 computer players, a 10-second turn timer and a 300 ms computer
delay. Rolls were forced with `POST /debug/force-roll`.

## The die lands on the server's value (FR-SYS-02 POST-02-2, NFR-SYS-05)

| Forced | Pressed with | Pending at once? | Blank while tumbling? | Face after landing | Time to land |
|---|---|---|---|---|---|
| 1 | Double click | Yes | Yes | 1 | About 630 ms |
| 3 | `R` key | Yes | Yes | 3 | About 615 ms |
| 1 | `R` key, Animations set to Off | Landed before the first check | Landed before the first check | 1 | Under 160 ms, about 120 ms of it the test script's own pause |
| 6 | Space on the die | Yes | Yes | 6 | About 620 ms |

The double click caused no "You already rolled" message (FR-SYS-02 EXC-02-1).
`NFR-SYS-05-die-shows-six.png` shows the die after the forced 6.

## Whose turn it is (FR-SYS-02 POST-02-1, FR-SYS-07)

- **My turn to roll:** "Your turn — roll the dice", and the die can be pressed
  (`FR-SYS-02-your-turn.png`).
- **After my roll:** "Your turn — pick a piece", and the die can't be pressed.
- **A computer's turn:** "Computer is thinking…" with moving dots, and the die can't be pressed
  (`FR-SYS-07-computer-thinking.png`). Pressing `R` during it did nothing.
- **Screen reader:** the hidden "Your turn" announcement filled in when the turn came to me.
- **Sixes counter:** one pip filled after the forced 6.

## Countdown and timeout

- The ring works from the server's deadline: it read 9 seconds, then 7 seconds 2.1 s later.
- In two runs "Time's up — the computer will play for you." showed for about 1 second (1003 ms
  and 1002 ms).
- The app sent nothing. With no press from me, the server brought my piece out 9.2 to 9.3 s after
  my last roll.

## Other checks

- **Keyboard (NFR-SYS-08):** the die keeps keyboard focus through a roll. Tab now goes Rules,
  Settings, Sound, the die.
- **Window sizes (FR-SYS-09, NFR-SYS-10):** re-measured with the taller dice panel. There is still
  no page scrolling and every part is in view at 1280×720, 1024×768, 1366×768 and 1920×1080, and no
  sideways scrolling at 1000, 800 or 360 px wide.
- **Console:** no errors in any run.

## Not checked here

- A roll the server refuses (EXC-02-2) and a reply that arrives before the new state are proved by
  `src/screens/GameScreen.test.tsx` and `src/interaction/useDiceRoll.test.ts` only. The mock can't
  be told to refuse a roll, and it always sends the new state first.
- Only Edge and the mock have been tried.
