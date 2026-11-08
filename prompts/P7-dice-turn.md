# P7 — Dice, turn indicator, turn gating

**Implements:** FR-SYS-02 (active turn and dice), NFR-SYS-05 (dice value not
altered), FR-SYS-07 (show computer turns)
**Read first:** `docs/00-requirements.md` (FR-SYS-02), `docs/03-ui-spec.md`
S4, the `ludo-contract` skill

## Turn gating
Roll is enabled only when **all** are true — each from a selector, never a
stored flag:
- `snapshot.status === "IN_PROGRESS"`
- `turn.activePlayerId === myPlayerId`
- `turn.phase === "AWAITING_ROLL"`
- `pendingCommand === null`
- connection is `"live"`

## Rolling (FR-SYS-02 normal flow)
1. Click, Space/Enter on the die, or `R` → `store.roll()`. The button shows
   pending **at once** (NFR-SYS-01).
2. Start the tumble.
3. Stop the tumble **on `turn.lastRoll`** from the snapshot (POST-02-2,
   NFR-SYS-05).
4. Rejected or timed out → stop, keep state, friendly message, re-enable
   (EXC-02-2).
5. Extra clicks while pending do nothing (EXC-02-1).

There must be **no** `Math.random` anywhere in `src/` outside tests. Add an
ESLint `no-restricted-properties` rule for it.

## Turn indicator (FR-SYS-02 POST-02-1)
Text, not just colour:
- mine: "Your turn — roll the dice" / "Your turn — pick a piece"
- a human: "<Name>'s turn"
- a computer: "Computer is thinking…" with a subtle animated dots indicator
  (FR-SYS-07 — the server runs the AI; we just show it)

Plus the active `PlayerCard` ring, and a sixes counter (3 pips from
`turn.sixesInRow`) when `rules.threeSixesForfeit` is true.

## Countdown
`CountdownRing` from `turn.deadline`. Recompute seconds-left from the clock
every second (don't count down a local number). Hide when
`rules.turnTimerSeconds === 0`. At zero: "Time's up — the computer will play
for you." Send nothing; the server acts.

## Screen reader
The message area already announces events. Also announce "Your turn" when it
becomes mine.

## Tests
- `Dice.test.tsx`: given `value=6`, after rolling ends the face shows 6.
- Gating: each of the five conditions false → button disabled.
- Double click → one `roll` command (`FakeAdapter` records commands).

## Done when
Against the mock with 3 computer players: roll enabled only on your turn; use
`POST /debug/force-roll` to force 6, 1 and 3 and confirm the die shows exactly
that each time; computer turns show "Computer is thinking…"; the ring counts
down and a timeout is handled by the server.
Update traceability rows FR-SYS-02, NFR-SYS-05, FR-SYS-07.
