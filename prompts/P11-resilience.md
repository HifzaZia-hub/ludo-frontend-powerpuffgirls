# P11 — Disconnect, reconnect, resync

**Implements:** NFR-SYS-03 (no crash), NFR-SYS-04 and FR-SYS-04 EXC-04-1
(keep last valid state on failure, offer retry)
**Read first:** `docs/01-contract.md` §7, the `ludo-contract` skill

This is the task that makes the demo survive a flaky university wifi. It is
also the most impressive thing to show a grader, because most student projects
break here.

## Connection banner

A sticky top banner driven by the store's `connection` field:
- `reconnecting` — amber, "Reconnecting…", with a spinner
- `lost` — red, "Disconnected", with a `Try again` button
- `live` — no banner

The board stays visible and readable the whole time. Interactive controls grey
out. Never show a blank screen or a full-page spinner over a live match — the
player wants to watch what the AI stand-in is doing on their behalf.

## Reconnect flow

socket.io reconnects on its own. Our job when the adapter reports `"live"`
again after `"reconnecting"`:
1. `store.resync()` → `adapter.sync(knownVersion)`
2. apply the returned snapshot through the normal version guard
3. drain and reset any stranded animation state
4. clear the banner

Do not write a custom retry loop, and do not tear down and rebuild the socket.

## Refresh survival

`sessionToken` lives in `sessionStorage`. On app mount, if a token and
`roomCode` are present, reconnect straight into the room and skip the main screen.
Show a brief "Rejoining your game…" state while the first snapshot arrives.

Test this properly: start a match, hit F5 mid-turn, confirm the board comes
back with the same positions and the same turn.

## Stand-in UI

While a human is disconnected the server's AI plays their turns.
- That player's chip shows an `offline` badge and "AI is playing"
- If it is **my** seat being played by the stand-in (I reconnected
  mid-turn), say so clearly: "You were away — the computer played your turn"
- On `PLAYER_RECONNECTED`, restore the chip and toast "<Name> is back"

## session:replaced

Another tab took the session. Stop reconnecting and show a blocking card:
"This game is open in another tab." with a `Play here instead` button that
reconnects this tab. Do not silently fight over the socket — two tabs
reconnecting in a loop is a horrible bug to debug later.

## PLAYER_IDLE

The server sends this after three automatic actions in a row for a connected
human. If it is me, show a gentle modal: "Still there? The computer has been
playing your turns." with a dismiss button.

## Version gap handling

Verify, with the mock: if we artificially drop a `game:state`, the next event
arrives with a version more than 1 ahead and we emit `state:sync` and recover.
Add a mock debug endpoint that skips one broadcast so this is testable.
Also add a `FakeAdapter` unit test for the same gap.

## Done when
Demonstrate and report on each: (a) F5 mid-match restores the board,
(b) killing the mock server shows the banner and recovery on restart,
(c) opening the same room in a second tab produces the `session:replaced` card,
(d) a dropped snapshot self-heals via `state:sync`.

Every message on these screens comes from `src/feedback/copy.ts` and reads
like "Connection lost — trying again…", not "socket disconnected".
Update traceability rows NFR-SYS-03, NFR-SYS-04.
