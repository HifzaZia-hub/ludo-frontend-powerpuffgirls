# P13 — Local multi-seat (same-device play)

**Implements:** D2 FR-03 for Rida's case ("play with friends on the same
device")
**Status:** **TO CONFIRM.** Do not start until (a) the client confirms
same-device play is needed and (b) the backend team confirms one browser may
hold several sessions (open question in `docs/01-contract.md`). If either
says no, delete this file and note the decision in `docs/00-requirements.md`
§5.

**Read first:** `docs/01-contract.md` §9, `docs/00-requirements.md` §5

## Idea
One browser creates a room, then joins it again once per extra local player.
It holds one `LgsAdapter` (one session token, one socket) per local seat. A
`LocalMultiSeatAdapter` implements `GameAdapter` on top of them:
- commands go through the adapter of **whichever local seat is active**
- snapshots/events from all sockets are merged by `version` (they are the same
  stream; drop duplicates via the store's version guard)

The UI barely changes — which is the point of the adapter (NFR-SYS-12):
- "my turn" becomes "a local player's turn"
- the turn text says "Pass to Hamza — Hamza's turn" between local players
- Setup gets a "Players on this device" list with a name per local seat
  (this is also where the FR-SYS-01 "name per seat" finally fits)

## Done when
Two local players + two computers play a full game in one tab, by keyboard,
with turns handed over clearly. All P3 store tests still pass unchanged.
