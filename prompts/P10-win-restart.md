# P10 — Win screen, restart, leave, confirm, session score

**Implements:** FR-SYS-06 (winner, ranking, session score — never fabricated),
FR-SYS-08 (restart / exit / rematch with confirmation)
**Read first:** `docs/00-requirements.md` (FR-SYS-06, FR-SYS-08, §5 rows on
ranking), `docs/03-ui-spec.md` S7 and Confirm dialog

## Win screen (FR-SYS-06)
Switch to it **only** on `GAME_OVER` (POST-06-2), after the feedback queue
drains. Never compute a winner (EXC-06-1).
- "<Name> wins!" with a crown and their `PlayerMark`.
- Ranking of the others **only if** `snapshot.ranking` is present. Don't sort
  it yourself (POST-06-3). If absent, show just the winner (ALT-06-1).
- Confetti (canvas-confetti) unless reduced motion / Animations Off.
- Win sound if sound is on.

## Session score (D2 FR-29 — TO CONFIRM)
Behind `SHOW_SESSION_SCORE` in `src/config/app.ts`, default `true`.
A tally of wins per `playerId`, counted **only** from `winnerId` in
`GAME_OVER` snapshots. Kept in memory, reset when you leave the room. Shown on
the win screen and as a small badge on each `PlayerCard`. This is counting
server results, not deciding anything.

## Controls (FR-SYS-08)
| Control | Who | Flow |
|---|---|---|
| Play again | host | `adapter.restart()`; non-hosts see "Waiting for <host>" |
| New game | anyone | leave room → Setup with previous choices pre-filled (D2 FR-33) |
| Main menu | anyone | leave room → main screen |
| Restart (in-game menu) | host | **ConfirmDialog** → `adapter.restart()` |
| Leave (in-game menu) | anyone | **ConfirmDialog** → `adapter.leave()` |

- Confirm before anything that discards an active game (FR-34).
- Cancel leaves everything exactly as it was (POST-08-1) — test it.
- A failed restart keeps the current state and shows an error (POST-08-3,
  EXC-08-1).
- Disable Play again for 5 s after a press (server rate-limits restarts).

On `GAME_RESTARTED`: clear `lastEvent`, `eventLog`, the feedback queue and any
animation state; go to the game screen. **Check no piece from the old match is
left on the board.**

`GAME_ABANDONED` → "This game was stopped" with Main menu / New game.

## Dice fairness (optional, ~30 min, worth it)
Expandable "Check the dice were fair": show `seedHash` (from `GAME_STARTED`)
and the revealed `seed`; compute SHA-256 of the seed with
`crypto.subtle.digest`; green tick if it matches. One plain line explaining
why this proves the dice weren't changed mid-game. Supports Hamza's
"dice must be fair" (D2) and NFR-SYS-05.

## Done when
Mock `near-win` scenario → finish → correct winner; ranking shown only because
the server sent it; session score increments after a rematch; Restart → Cancel
leaves the game unchanged; Restart → confirm resets the board completely; a
non-host sees the waiting state.
Update traceability rows FR-SYS-06, FR-SYS-08.
