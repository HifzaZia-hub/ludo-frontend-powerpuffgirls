# FR-SYS-01, FR-SYS-10: start, join, lobby and settings in a real browser

Checked on 2026-11-08, on branch `feat/p5-main-setup-lobby`, in Microsoft Edge (headless) against
the mock server. A script pressed real keys and clicked with the real mouse through the DevTools
Protocol, in separate browser tabs. All 115 checks passed, with no JavaScript errors.

## P5's "done when" list

| Check | Result |
|---|---|
| Tab A creates a friends game with 4 seats | Lands in the waiting room with a six-character code |
| Tab B joins by code | Sees "Game found!", then the waiting room |
| Both see each other live | A sees B arrive and B sees A, with no reload |
| A adds a computer player | Both tabs show it. Nothing changes until the server says so |
| A starts | Both tabs reach the game screen |
| Play with computer, 2 seats | Goes straight to the game. The waiting room was never drawn |
| Force `NAME_TAKEN` by joining as "hamza" when "Hamza" is seated | Both fields keep their values, the message is under the name, and focus moves there. Changing the name and pressing Join once works. See `FR-SYS-01-name-taken.png` |
| Keyboard-only run of the whole flow | Passed, using only Tab, Shift+Tab, Enter, Space, the arrow keys and typing. Details below |
| Switch theme in Settings on every screen | Worked on the main, setup, waiting room and game screens. See `FR-SYS-10-lobby-light.png` |

## Keyboard-only run

Main screen, in tab order: New Game, Join Game, How to play, Settings. Then `?` opened the rules, Esc
closed them, and focus went back to where it was.

Setup: Enter on New Game put focus on the heading. Arrows chose 3 players and "Play with friends".
Typing `?` in the name field typed it and opened nothing. Enter on that bad name explained the
problem. Tab reached Back and then Start.

Waiting room: Enter copied the code. Space added a computer. When that button disappeared, the next
Tab carried on to the next empty seat. Space turned on "Fill empty seats", and Enter started the
game with every seat filled.

Game screen: Tab reached Settings. An arrow key changed the theme straight away, and Esc returned
focus to the Settings button.

## When things go wrong (FR-SYS-01 EXC-01-1, FR-SYS-08)

| Check | Result |
|---|---|
| The server is stopped, then Start is pressed | A friendly message appears. The name, 3 seats and "Play with friends" are all kept. See `FR-SYS-01-server-down-keeps-form.png` |
| Start is pressed again while the server is down | Still one message, not two |
| The server comes back and Start is pressed once | Reaches the waiting room, and the old message is gone |
| Join while the server is down | The message shows inside the join window, and both fields are kept |
| A letter or number that codes don't use (`0`) | Refused, and the form says why |
| Leave, then Esc or Cancel | Nothing changes, and the other players see nothing. Cancel has focus first |
| Leave, then Leave | Back on the main screen. The saved session is cleared and the other players see the seat empty |

## Also checked

- The session token is saved to `sessionStorage` and does not appear anywhere in the page.
- At 1280×720 the host's waiting room fits with no scrolling, even with all four seats listed.
- At 360 px wide there is no sideways scrolling, even with a 20-character name.
- The clipboard really held the room code after Copy.
- Both themes were checked by eye. That found three problems, all now fixed: the waiting room
  needed a scrollbar at 1280×720, the focus ring on headings ran the full width of the page, and
  the Settings gear drew as a faded emoji in the light theme.

## Limits of this check

- Only Edge has been tried. Chrome and Firefox are for P12.
- The game screen is a stand-in until P6, so "reaches the game screen" does not yet mean a board
  was drawn.
- The join form says "Game found!" and not "2 of 4 players · waiting". The backend hasn't named the
  preview's fields (`docs/01-contract.md` §8), so nothing reads inside the preview.
- `SERVER_BUSY` and `RATE_LIMITED` were tested with `FakeAdapter`, not forced from the mock. The
  browser run covered the server being unreachable.
