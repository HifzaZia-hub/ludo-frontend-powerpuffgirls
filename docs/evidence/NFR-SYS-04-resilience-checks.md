# Disconnect, reconnect and resync checks (P11)

Run on 2026-11-09 in headless Edge, using the real app and the mock server. The mock's debug routes
`/debug/drop-connection` and `/debug/skip-state` were added for these checks.

## The task's four demonstrations

### (a) Refreshing in the middle of a turn

A real match, refreshed while the chooser was open after a roll.

| | Result |
|---|---|
| The board | Identical before and after |
| The turn | Identical: "Your turn — pick a piece" |
| The moves on offer | Identical |
| What showed meanwhile | "Rejoining your game…", then the game |

`NFR-SYS-04-after-refresh.png`. The message log starts empty after a refresh, because it is kept in
memory only. Refreshing on the win screen brought the win screen back.

### (b) Killing the server

With `mock-server/index.ts` stopped under a running match:

- The banner said "Reconnecting…", the board was unchanged and the die was locked.
  `NFR-SYS-04-server-down.png`.
- When the mock was restarted it knew nothing about the game, because it keeps rooms in memory. The
  app said "Your game session ended. Please start again.", cleared the session and went to the main
  screen.

**A connection that drops while the server stays up recovers fully.** `/debug/drop-connection` cut the
connection for 7.5 seconds during the player's turn:

- The banner appeared, all 16 pieces stayed drawn, and the die and Menu were off.
  `NFR-SYS-04-reconnecting.png`.
- The computer played the turn on the server. On coming back the banner went away, the board
  updated, and the player saw "You were away — the computer played your turn."
  `NFR-SYS-04-you-were-away.png`.

### (c) The same session in a second tab

Opened by copying the session into a new tab, because joining with the code makes a new player.

- The first tab showed the blocking card "This game is open in another tab." with no banner.
  `NFR-SYS-04-open-in-another-tab.png`.
- 2.5 seconds later nothing had changed, so the tabs weren't fighting over the session.
- Pressing "Play here instead" gave the first tab the board and the second tab the card. It was still
  settled 2.5 seconds later.

### (d) A lost snapshot

`/debug/skip-state` lost the state after a roll. When the next one arrived two versions on, the app
sent `state:sync` once, the die stopped, and the turn had moved on correctly.

## Other checks

- **A match that ends while you're away:** with the connection cut, the computer finished the last
  move. On coming back the app went straight to the win screen, although `GAME_OVER` was missed.
- **Another player dropping out:** after a guest refreshed, the host's panel showed them offline, then
  the message "Hamza is back."
- **Going quiet:** when the 10-second timer ran out on the player's turn, "Still there? The computer
  has been playing your turns." appeared and could be dismissed. `NFR-SYS-04-still-there.png`.
- **Whole games on the final code:** one by mouse (95 rolls, 57 moves) and one by keyboard alone
  (105 rolls, 73 moves), both to a winner with no console errors. Every earlier check for moves,
  events, the win screen and restart was run again and still passes.
- **Your exact setup:** `npm run mock` and `npm run dev`, with default rules: 9 rolls and 6 moves with
  no console errors.

## Not checked here

These are proved by tests only:

- The red "Disconnected" banner with Try again. socket.io keeps retrying a dead server forever, so it
  only appears if the server itself ends the connection, which the mock doesn't do to a live game.
- A crash on a screen other than the game.

Also:

- "You were away" appears only if one of the player's pieces moved forward while disconnected. If the
  computer rolled and had no move, or the refresh itself was too quick to notice, nothing is said.
- The mock sends `PLAYER_IDLE` after one timeout, where the task's prompt says three automatic
  actions. The dialog follows whatever the server sends.
- Only Edge and the mock have been tried, and scripts played the games.
