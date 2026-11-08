# P5 — Main screen, setup, lobby, settings, rules

**Implements:** FR-SYS-01 (start and configure), FR-SYS-10 (settings),
D2 FR-07 (rules before the game), FR-SYS-07 (choose computer players)
**Read first:** `docs/00-requirements.md` §3 and §5, `docs/03-ui-spec.md` §4
(S1–S3, Settings, Rules), `docs/01-contract.md` §1–§2, the `ludo-ui` skill

## Routing
`uiStore.screen`: `"main" | "setup" | "lobby" | "game" | "win"`. Switch in
`App.tsx`. Settings, Rules and Confirm are modals.

## Main screen (S1)
New Game · Join Game · How to play · Settings. "How to play" opens
`RulesSummary` with `defaultRules`, titled "Standard rules".

## Setup (S2) — FR-SYS-01
- Players: 2 / 3 / 4. Mode: "Play with friends" / "Play with computer".
  Name. Computer difficulty (Easy / Normal) when relevant.
- Map to `{ displayName, mode, seats, aiDifficulty }` → `adapter.createRoom`.
- Client-side name check mirrors the server's rule (1–20 chars: letters,
  digits, space, `_ - .`) so the common mistake never round-trips. Still handle
  the server's `INVALID_NAME`.
- **On any error, keep every typed value** (ALT-01-1, EXC-01-1). Field errors
  go under their field via `FIELD_ERRORS`; others go to a toast. Retry must be
  one click.
- Colour: show "You will be <PlayerMark> Red" read-only for now. Leave a clear
  TODO referencing the open question in `01-contract.md` (FR-06).

## Join
6-character code field: upper-cases as you type, rejects characters outside
`ABCDEFGHJKMNPQRSTUVWXYZ23456789`. At 6 chars, `previewRoom` and show
"2 of 4 players · waiting" before asking for a name.

## Lobby (S3)
On create/join success: store `playerId`, `roomCode`; `sessionToken` in
`sessionStorage`; `adapter.connect`; go to lobby.
- Big room code + Copy (with "Copied!" confirmation).
- Seats from `RoomSnapshot.seats` using `PlayerMark`. Empty seat: host sees
  **Add computer player** (`adapter.addAi`); others "Waiting for a player…".
- **Start game** (host only) with "Fill empty seats with computer players".
- **Leave** → `ConfirmDialog` → `adapter.leave()` → main screen.
- Never edit the seat list locally; it only changes on `room:updated`.
- On `GAME_STARTED` → `screen = "game"`.

## Settings modal — FR-SYS-10
Sound On/Off · Animations On/Fast/Off · Theme Dark/Light. Changes apply
immediately and never touch game state (POST-10-3). Reachable from the main
screen now; the game screen gets a button in P6.

## Keyboard (NFR-SYS-08)
Every step of setup → lobby → start works with Tab/Enter/Space/arrows only.
Test it.

## Errors to handle explicitly
`ROOM_NOT_FOUND`, `ROOM_FULL`, `NAME_TAKEN`, `GAME_ALREADY_STARTED`,
`INVALID_CODE`, `INVALID_NAME`, `NOT_ENOUGH_PLAYERS`, `SERVER_BUSY`,
`RATE_LIMITED` — all with copy from `src/feedback/copy.ts`.

## Done when
Against the mock, with two browser tabs: A creates (HvH, 4 seats), B joins by
code, both see each other live, A adds a computer player and starts, both reach
the game screen. Also: HvC with 2 seats starts straight away. Also: force a
`NAME_TAKEN` and confirm the form keeps its values. Keyboard-only run of the
whole flow. Switch theme in Settings on every screen.
Update traceability rows FR-SYS-01, FR-SYS-10.
