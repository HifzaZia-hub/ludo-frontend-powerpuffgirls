# P9 — Event feedback: capture, finish, extra turn, messages, sound

**Implements:** FR-SYS-05 (events shown, never invented), D2 FR-23, FR-36
(last action message), FR-SYS-10 / D2 FR-37 (sound on/off)
**Read first:** `docs/03-ui-spec.md` S6 and §6, `docs/01-contract.md` §4

Pure feedback. No new state about the game, no decisions.

## One pipeline
`src/feedback/useEventFeedback.ts` watches `store.lastEvent` and dispatches to
a handler per `EventType`. Each handler may: animate, play a sound, add a
message, show a banner.

The server can send `MOVED`, `CAPTURED`, `PIECE_FINISHED`, `BONUS_TURN` for
one move. Play them **in order**, one at a time, through a small FIFO queue.
Drop the queue on `GAME_RESTARTED` or `GAME_OVER`. With Animations Off, the
queue still runs but every step is instant.

## Message area (FR-36)
`src/feedback/messages.ts`: `eventToMessage(event, snapshot): string | null`
using the templates in `03-ui-spec.md` §6. Use player **names**.
- Merge a roll with its result when they arrive together:
  "Hifza rolled 4 and captured a piece" (the D2 example).
- Return `null` for events with nothing to say. **Never** make up an event
  that wasn't sent (EXC-05-1).
- Unit-test every template.

## Feedback per event
| Event | Feedback |
|---|---|
| `CAPTURED` | flash, shake, fly back to base (staggered if several) |
| `PIECE_FINISHED` | rise into centre with a glow; PlayerCard Home count bumps |
| `BONUS_TURN` | "Roll again!" banner (gating needs no special case — the snapshot already says it's still your turn) |
| `TURN_PASSED` | short banner + message |
| `TURN_FORFEITED` | sixes pips flash + message |

## Sound (FR-37)
Howler sprite: roll, move, capture, finish, win, error. All under 400 ms.
Respect `settings.sound`; first sound only after a user gesture. Placeholder
sounds are fine — say so in the commit.

## Done when
`capture-ready` scenario plays: move → capture → extra turn, in order, not
overlapping. Message log reads like a story of the game. Same run with
Animations Off and Sound Off works and ends in the same state.
Update traceability rows FR-SYS-05, FR-SYS-10 (sound).
