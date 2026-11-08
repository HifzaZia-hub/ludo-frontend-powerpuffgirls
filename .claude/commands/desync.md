---
description: Debug a state desync, stale board, or wrong-position bug
argument-hint: <what you saw go wrong>
---

Symptom: $ARGUMENTS

Work through this checklist in order and report what you find at each step.
Do not jump to a fix until you can name the cause.

1. **Version guard** — does the store drop snapshots where
   `incoming.version <= current.version`? Show me the code.
2. **Single source of truth** — grep for `useState` and store fields that hold
   anything derived from the snapshot (turn, legal moves, piece positions,
   player list). Any copy is a suspect.
3. **Optimistic updates** — does anything move a piece, set a dice value, or
   flip the turn before the server says so? That is the usual cause.
4. **Gap handling** — if a version arrives more than 1 ahead, do we emit
   `state:sync` (via `adapter.sync`)? Does the reconnect handler call it?
5. **Keys** — are pieces and players keyed by `id`, not by array index?
6. **Event vs snapshot** — is any position read out of a `game:event` payload
   instead of the snapshot?
7. **Animation state** — is a piece's rendered position driven by animation
   state that can get stranded if a new snapshot lands mid-animation?

8. **Adapter boundary** — is anything outside `src/adapter/` listening to the
   socket directly and writing to state on its own?

Then: name the single most likely cause, propose the smallest fix, and tell me
how to reproduce the bug against the mock server so we can confirm it is gone.
