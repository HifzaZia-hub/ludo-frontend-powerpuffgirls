# 01 — Integration Contract (LGS v1.0.0)

Started from **D3 System Requirements, section 3.4**, written by The Assemblers.

**Since 2026-11-21 this file is the spec.** The backend team asked us to build the front end
first, and they will build the LGS to match it. So this file, with the mock server in
`mock-server/` as its working example, says what the LGS must do. Where it decides something new,
it says so. §8 lists every decision taken for this, and the one thing still open.

All payloads are JSON (UTF-8). Every server message carries a contract version
field `v` (currently `"1.0.0"`). REST paths are prefixed `/api/v1`.

---

## 1. REST endpoints

Used only before the realtime connection exists: create, join, preview, health.

Every error response has the HTTP status from §6 and a body that is the `ServerError` itself plus
`v`, not nested under another key:
```ts
{ v: string; code: ErrorCode; message: string; requestId?: string; details?: unknown }
```

### POST /api/v1/rooms — create a room

Request body:
```ts
{
  displayName: string;              // 1-20 chars: letters, digits, space, _ - .
  mode: "HUMAN_VS_HUMAN" | "HUMAN_VS_AI";
  seats: 2 | 3 | 4;
  aiDifficulty?: "EASY" | "NORMAL"; // default NORMAL
  rules?: Partial<RuleConfig>;      // see section 5
  colour?: Colour;                  // the host's colour, default "RED" (FR-SYS-01, D2 FR-06)
}
```
Success `201`:
```ts
{ v: string; roomCode: string; playerId: string; sessionToken: string; room: RoomSnapshot }
```
Errors: `400 INVALID_PAYLOAD` (including a `colour` that isn't one of the four), `400 INVALID_NAME`,
`400 INVALID_RULES`, `503 SERVER_BUSY`.

Notes:
- The creator is always the **host** and takes **seat 1, in the colour they chose** (Red if they
  chose none).
- **Decided 2026-11-21 (colour choice):** the room's colours go clockwise round the board from the
  host's colour, and seat order is that clockwise order:
  - 2 seats: the host's colour and the **opposite corner** (our rule R1), e.g. Green and Blue.
  - 3 seats: the host's colour and the **next two clockwise**, e.g. Blue, Red, Green.
  - 4 seats: all four, starting from the host's.
  With no `colour` this gives Red and Yellow, Red to Yellow, or all four, as before.
- In `HUMAN_VS_AI` the other seats are filled with AI players immediately.

### POST /api/v1/rooms/{roomCode}/join — join a room

Request body:
```ts
{
  displayName: string;
  colour?: Colour; // one of the room's free seats' colours. Left out: the first free seat.
}
```
Success `200`: `{ v, playerId, sessionToken, room }`
Errors: `400 INVALID_CODE`, `400 INVALID_PAYLOAD` (a `colour` that isn't one of the four),
`404 ROOM_NOT_FOUND`, `409 ROOM_FULL`, `409 GAME_ALREADY_STARTED`, `409 NAME_TAKEN`,
`409 COLOUR_TAKEN` (the colour isn't free in this room: taken, or not one of its colours),
`429 RATE_LIMITED`.

The server upper-cases the code. The client should also upper-case before
sending and strip spaces.

### GET /api/v1/rooms/{roomCode} — preview before joining

Success `200`: the room's `RoomSnapshot` (section 5), with its status, mode, rules, host and every
seat with its colour and player. **Decided 2026-11-21:** this is how the join form knows which
colours are still free (the seats whose `player` is `null`).
Error: `404 ROOM_NOT_FOUND`.

### GET /api/v1/health

Success `200`: `{ status, uptimeS, rooms, clients, version }`.
Useful for a dev-only "server up / server down" badge.

---

## 2. Room code format

Six characters from `ABCDEFGHJKMNPQRSTUVWXYZ23456789`.
No `I`, `L`, `O`, `0` or `1` — they are easy to misread.
Example: `K7QX2M`.

The join input should:
- force upper case as the user types
- reject characters outside that alphabet instead of silently sending them
- be a single 6-char field (one box is fine; six boxes is nicer if time allows)

---

## 3. Socket.IO — client to server (commands)

Connect with:
```ts
io(SERVER_URL, { auth: { sessionToken } })
```

Every command gets a direct **acknowledgement** sent only to the sender:
```ts
type Ack =
  | { v: string; ok: true; version: number; requestId?: string }
  | { v: string; ok: false; error: ServerError; requestId?: string };
```

- `requestId` is copied from the command, at the top level of the ack. A refused command has it in
  `error.requestId` too.
- `version` is the match's state version after the command. Before the room's first match starts
  (status `LOBBY`), there is no match, and it is `0`.
- When a command changes the game, the server sends that change's `game:event`s and `game:state`
  (§4) **before** the ack. The client copes with either order, because it waits for the state whose
  version the ack names, but the LGS should keep this one.

| Command | Payload | Who may send | When |
|---|---|---|---|
| `room:addAi` | `{ seat: number; difficulty: "EASY" \| "NORMAL" }` | host | status `LOBBY` |
| `room:leave` | `{}` | any player | any time |
| `game:start` | `{ fillEmptySeatsWithAi: boolean; aiDifficulty?: "EASY" \| "NORMAL" }` | host | status `LOBBY` |
| `game:roll` | `{ requestId?: string }` | active player | phase `AWAITING_ROLL` |
| `game:move` | `{ pieceId: string; requestId?: string }` | active player | phase `AWAITING_MOVE` |
| `game:restart` | `{}` | host | status `IN_PROGRESS` or `FINISHED` |
| `state:sync` | `{ knownVersion: number }` | any player | after a version gap or reconnect |

`requestId` is echoed back in the ack — use a uuid so you can match a reply to
the button press that caused it, and ignore acks for superseded presses.

Rate limits worth knowing (NFR-SEC-2): max **20 commands per second** per
connection, payload max **4 KB**. Disable the roll button while a roll is
in flight; do not let an impatient user spam it.

---

## 4. Socket.IO — server to client

| Message | Payload | Meaning |
|---|---|---|
| `room:updated` | `RoomSnapshot` | lobby changed (someone joined/left, AI added, host changed) |
| `game:state` | `{ v, version, snapshot: GameStateSnapshot }` | full state after a change |
| `game:event` | `{ v, version, type: EventType, data: unknown }` | one domain event |
| `error` | `ServerError` | unsolicited error (not a reply to a command) |
| `session:replaced` | — | another connection took over this session; this socket will close |

Ordering: for one change the server sends the `game:event` first, then the
`game:state` with the same `version`. **Render from the snapshot. Use the event
only to decide which animation or sound to play.**

Versions and changes (decided 2026-11-21):
- Every accepted change raises `version` by **exactly 1**. A restart begins a new `matchId` at
  version 1. The client walks a piece square by square only between neighbouring versions; across a
  bigger gap it asks for `state:sync` and the piece jumps.
- One change can cause several events. For example, a move that captures two pieces and earns a
  bonus sends `MOVED`, `CAPTURED`, `CAPTURED`, `BONUS_TURN`. They all carry that change's version,
  come in the order they happened, and are followed by **one** `game:state` with the same version.

### Event data (decided 2026-11-21)

In contract 1.0.0 the front end reads nothing from `game:event.data`. Everything it shows comes
from the snapshots, so the LGS may send `data: {}` (as the mock does) or the fields its D3 lists.
Clients ignore fields they don't know, so a later version can add fields without breaking anyone.

This works only because the LGS keeps these rules, which tell the client who an event is about:

| Event | Rule |
|---|---|
| `CAPTURED` | Once **per captured piece**, in the same change as the `MOVED` that captured it. The client matches each one to a piece that went back to its yard between the two snapshots. |
| `TURN_PASSED`, `TURN_FORFEITED` | About the player who was active in the **previous** snapshot. Each comes with `TURN_CHANGED` in the same change. |
| `PLAYER_IDLE` | About the player who was active in the previous snapshot. Sent **every time a connected human's turn timer runs out** (one missed turn is enough), as the first event of the change in which the server plays for them. The server then plays the rest of that turn (D3 G-12); their next turn is theirs again. |
| `PLAYER_DISCONNECTED`, `PLAYER_RECONNECTED`, `PLAYER_LEFT` | The snapshot's `connected` and `isAi` show who. |
| `GAME_OVER` | The snapshot carries `winnerId`, `ranking` and `seed`. |

### Event types

```
GAME_STARTED      ROLLED            MOVED              CAPTURED
PIECE_FINISHED    BONUS_TURN        TURN_CHANGED       TURN_PASSED
TURN_FORFEITED    PLAYER_DISCONNECTED  PLAYER_RECONNECTED  PLAYER_LEFT
PLAYER_IDLE       GAME_OVER         GAME_ABANDONED     GAME_RESTARTED
```

What the UI should do with each (our mapping, not the server's concern):

| Event | UI reaction |
|---|---|
| `GAME_STARTED` | go to Game screen, show turn order, store `seedHash` |
| `ROLLED` | play dice animation, land on the rolled value, highlight legal moves |
| `MOVED` | animate the piece along its path, step by step |
| `CAPTURED` | flash + shake the captured piece, then send it to its yard; sound |
| `PIECE_FINISHED` | small celebration on the home triangle |
| `BONUS_TURN` | "Roll again!" banner, keep turn with same player |
| `TURN_CHANGED` | move the turn indicator, restart the timer ring |
| `TURN_PASSED` | toast "No legal move — turn passed" (server waits 1s before ending) |
| `TURN_FORFEITED` | toast "Three sixes — turn lost" |
| `PLAYER_DISCONNECTED` | grey out that avatar, show "AI is playing for them" |
| `PLAYER_RECONNECTED` | restore avatar |
| `PLAYER_LEFT` | mark seat as AI for the rest of the match |
| `PLAYER_IDLE` | nudge the local player: "Are you still there?" |
| `GAME_OVER` | Win screen, confetti, show winner + ranking + revealed seed |
| `GAME_ABANDONED` | "Match abandoned" screen, back to lobby |
| `GAME_RESTARTED` | reset board, back to Game screen |

---

## 5. Data shapes

**These shapes are the spec (decided 2026-11-21).** The LGS sends exactly these keys, with this
spelling and case: for example `isAi` (not `isAI`), colours in capitals (`"RED"`), `seats` as
`{ seat, colour, player }` with `hostId`, `captures` as piece IDs, and the room under the key
`room` in the create and join responses. The same types are in `src/contract/` (`types.ts`,
`errors.ts`, `events.ts`). There is no npm package: the backend copies those files, and `v` says
which version of them a message follows.

```ts
export type Colour = "RED" | "GREEN" | "YELLOW" | "BLUE";
export type RoomStatus = "LOBBY" | "IN_PROGRESS" | "FINISHED" | "CLOSED";
export type TurnPhase = "AWAITING_ROLL" | "AWAITING_MOVE";
export type Difficulty = "EASY" | "NORMAL";
export type GameMode = "HUMAN_VS_HUMAN" | "HUMAN_VS_AI";

export interface RuleConfig {
  turnTimerSeconds: number;      // default 30. 0 = no limit for connected humans, else 10-120
  threeSixesForfeit: boolean;    // default true
  bonusOnSix: boolean;           // default true
  bonusOnCapture: boolean;       // default true
  bonusOnFinish: boolean;        // default true
  safeSquares: number[];         // default [0, 8, 13, 21, 26, 34, 39, 47]
  autoMoveSingleOption: boolean; // default false
  aiDelayMs: number;             // default 700, range 0-2000
  standInDelayMs: number;        // default 3000, range 0-10000
}

export interface Player {
  id: string;
  name: string;
  colour: Colour;
  isAi: boolean;
  connected: boolean;
  isHost: boolean;
  piecesHome: number;            // 0-4
}

export interface Piece {
  id: string;                    // "R1".."R4", "G1".., "Y1".., "B1".."B4"
  colour: Colour;
  step: number;                  // 0 = yard, 1-51 = main track, 52-56 = home column, 57 = home
  boardSquare: number | null;    // 0-51 when on the main track, else null
}

export interface LegalMove {
  pieceId: string;
  fromStep: number;
  toStep: number;
  captures: string[];            // piece IDs this move would capture
}

export interface TurnState {
  activePlayerId: string;
  phase: TurnPhase;
  lastRoll: number | null;       // 1-6. null until the match's first roll, then kept until the
                                 // next roll, also after the turn has passed
  sixesInRow: number;            // 0-2 (a third six ends the turn)
  legalMoves: LegalMove[];       // non-empty only in AWAITING_MOVE
  deadline: string | null;       // ISO 8601 in UTC, e.g. "2026-11-21T10:15:30.000Z". null when
                                 // turnTimerSeconds is 0, and once the match is over
}

export interface GameStateSnapshot {
  v: string;
  roomCode: string;
  matchId: string;
  version: number;
  status: RoomStatus;
  rules: RuleConfig;
  players: Player[];             // in seat order, which is turn order (see below)
  pieces: Piece[];
  turn: TurnState;
  seedHash: string;              // SHA-256 of the seed's UTF-8 text, as 64 lower-case hex digits
  winnerId?: string;             // only once the match is over
  ranking?: string[];            // player IDs, best first
  seed?: string;                 // revealed only when the match is over
}

export interface RoomSnapshot {
  v: string;
  roomCode: string;
  status: RoomStatus;
  mode: GameMode;
  rules: RuleConfig;
  hostId: string;
  seats: Array<{
    seat: number;
    colour: Colour;
    player: Player | null;       // null = empty seat
  }>;
}

export interface ServerError {
  code: ErrorCode;
  message: string;               // plain English, <= 120 chars, safe to show the player
  requestId?: string;
  details?: unknown;
}
```

Rules about these fields (decided 2026-11-21):
- **Turn order.** `players` is in seat order, clockwise round the board. Turns go through it in that
  order and wrap round, starting from whoever `turn.activePlayerId` names. The status panel shows
  the array as sent and never sorts it.
- **A roll with no legal move.** The state stays in `AWAITING_MOVE` with an empty `legalMoves` for
  about 1 second, so the player sees the roll. Then one change sends `TURN_PASSED` and
  `TURN_CHANGED`. A `game:roll` during that pause gets `ALREADY_ROLLED`. The message
  "<Name> can't move. Turn skipped." is built from that state.
- **The dice check.** At the end the win screen checks that SHA-256 of `seed` equals `seedHash`. If
  the LGS makes the hash any other way, the screen says "We couldn't check this game's dice".

Note the server **never** sends session tokens, generator state, or the seed
while a match is running. If you ever see one in a snapshot, that is a backend
bug — report it.

---

## 6. Error catalogue

Branch on `error.code`, never on the text.

What the player sees (FR-SYS-04, NFR-SYS-08):
- For `ILLEGAL_MOVE`, show the **server's** `message` — it explains the
  specific reason ("A piece needs a 6 to leave the yard."), which is what
  FR-SYS-04 asks for.
- For every other code, show **our friendly copy** from the table in
  `docs/03-ui-spec.md` §7, and fall back to `error.message` if a code has no
  entry (ALT-04-1).
- Never show a code, a stack trace or raw JSON to the player.

| Code | HTTP | What the UI does |
|---|---|---|
| `INVALID_PAYLOAD` | 400 | toast; this is our bug — log it loudly in dev |
| `INVALID_NAME` | 400 | inline error under the name field |
| `INVALID_CODE` | 400 | inline error under the code field |
| `INVALID_RULES` | 400 | inline error on the rules form |
| `UNAUTHORIZED` | 401 | clear session, return to the main screen, "Your game session ended" |
| `NOT_HOST` | 403 | hide the control instead — this should not be reachable |
| `ROOM_NOT_FOUND` | 404 | inline error on the join form |
| `PIECE_NOT_FOUND` | 404 | our bug; resync with `state:sync` |
| `NAME_TAKEN` | 409 | inline error, let them retry with a new name |
| `COLOUR_TAKEN` | 409 | inline error under the colours; look the room up again and offer what is free now (added 2026-11-21) |
| `ROOM_FULL` | 409 | inline error on the join form |
| `GAME_ALREADY_STARTED` | 409 | inline error on the join form |
| `GAME_NOT_STARTED` | 409 | toast |
| `GAME_NOT_IN_PROGRESS` | 409 | toast; we are probably on a stale screen, resync |
| `NOT_ENOUGH_PLAYERS` | 409 | toast on the Start button; keep lobby open |
| `NOT_YOUR_TURN` | 409 | toast; our turn gating is wrong, resync |
| `ROLL_REQUIRED` | 409 | toast "Roll the die first" |
| `ALREADY_ROLLED` | 409 | toast; server re-sends legal moves, just render them |
| `ILLEGAL_MOVE` | 422 | toast with the server's specific reason; nothing changes |
| `RATE_LIMITED` | 429 | disable the control briefly, show "slow down" |
| `SERVER_BUSY` | 503 | full-screen "server is full, try again" |
| `INTERNAL_ERROR` | 500 | toast + offer a "resync" button |

Three codes mean *our client state is wrong*, not the user's fault:
`PIECE_NOT_FOUND`, `NOT_YOUR_TURN`, `GAME_NOT_IN_PROGRESS`.
On any of these, automatically send `state:sync { knownVersion }`.

---

## 7. Connection lifecycle

1. REST create/join → we hold `{ playerId, sessionToken, roomCode }`.
2. Save `sessionToken` to `sessionStorage`.
3. Connect socket with `auth: { sessionToken }`. If the token is unknown or has ended, the server
   refuses the connection: socket.io's `connect_error` fires with `message: "UNAUTHORIZED"` and a
   `ServerError` in `data` (`{ v, code: "UNAUTHORIZED", message }`). The client then clears the
   session and goes back to the main screen (§6).
4. On connect: we receive `room:updated` and, if a match is running, `game:state`.
5. On `disconnect`: show a reconnecting banner. socket.io retries by itself —
   do **not** write a custom reconnect loop.
6. On reconnect: send `state:sync { knownVersion: currentVersion }`.
7. On `session:replaced`: stop retrying, show "Opened in another tab", offer a
   "use this tab instead" button that reconnects.
8. The server drops a player's seat after **2 minutes** of absence in the lobby,
   and closes the room if no human is connected for 2 minutes.

Heartbeat: the server detects a lost connection within 25 seconds.
While we are away, an AI stand-in plays our turns after ~3 seconds per decision.

---

## 8. Decisions, and what is still open

Until 2026-11-21 this was a list of questions for the backend team. Since then the backend builds
the LGS to this contract, so we decided each one ourselves. Where the mock already behaved one
definite way and the front end was built on it, that became the rule, so the mock is still a
working example of the whole contract. Each decision is written into the section named.

### Still open

This one is a date, not part of the spec:

- [ ] **First connection to the real LGS.** The address is only a setting: `VITE_SERVER_URL` in
      `.env` (our `.env.example` points at the mock on 3001; the backend's default port is 3000,
      and its `CORS_ORIGINS` must allow `http://localhost:5173`). The date is to be agreed with the
      backend team in the first half of Sprint 4 (our D4, risk R1).

### Decided 2026-11-21

Each of these was an open question to the backend team. The decision follows the mock unless it
says otherwise.

- [x] **Snapshot keys** (`matchId`, `seedHash`, `winnerId`, `activePlayerId`, `lastRoll`,
      `sixesInRow`, `legalMoves`, `boardSquare`, `isHost`, `piecesHome`): exactly as in §5.
- [x] **`Player.isAi`**: that spelling, a boolean (§5).
- [x] **Colours**: in capitals, `"RED"`, `"GREEN"`, `"YELLOW"`, `"BLUE"` (§5).
- [x] **`RoomSnapshot`**: `seats` as an array of `{ seat, colour, player }`, with `player: null` for
      an empty seat; the host is `hostId` (§5).
- [x] **Create and join responses**: the room snapshot is under the key `room` (§1).
- [x] **`LegalMove`**: `{ pieceId, fromStep, toStep, captures }`, and `captures` are piece IDs (§5).
- [x] **`deadline`**: an ISO 8601 string in UTC, `null` with no time limit and once the match is
      over (§5).
- [x] **Contract package**: no npm package. The backend copies the files in `src/contract/` (§5).
- [x] **`game:event.data`**: the front end reads nothing from it, so `{}` is fine. The rules that
      let the client tell who an event is about are in §4, "Event data".
- [x] **REST error body**: the bare `ServerError` plus `v`, not nested under `error` (§1).
- [x] **Acks**: `requestId` at the top level and `v` in every ack (§3).
- [x] **Acks in the lobby**: `version` is `0` before the room's first match starts (§3).
      `LgsAdapter` still accepts a missing version on `room:addAi`, `room:leave` and `state:sync`.
- [x] **Refused socket connection**: a `ServerError` in the `data` of socket.io's `connect_error`
      (§7).
- [x] **`players` order**: seat order, which is turn order (§5).
- [x] **Ack or state first**: the change's events and state, then the ack (§3).
- [x] **`turn.lastRoll`**: kept until the next roll, also after the turn has passed (§5).
- [x] **A roll with no legal move**: about 1 second in `AWAITING_MOVE` with an empty `legalMoves`,
      then `TURN_PASSED` and `TURN_CHANGED` in one change (§5).
- [x] **Versions**: every accepted change raises `version` by exactly 1, and a restart starts again
      at 1 with a new `matchId` (§4).
- [x] **`CAPTURED`**: once per captured piece (§4).
- [x] **`PLAYER_IDLE`**: about the player whose turn timer ran out, sent each time it runs out for
      a connected human (§4). Our P11 prompt had said after three automatic actions. We took the
      mock's one: the player hears at once that the computer stepped in, the "Still there?" dialog
      is one click to close, and the front end already follows whatever the server sends.
- [x] **`seedHash`**: SHA-256 of the seed's UTF-8 text, as 64 lower-case hex digits (§5).

### Answered before 2026-11-21

Checked on 2026-11-08 against the backend's D3 v1 and its unmerged `feature/phase-0-foundation`
branch, or decided with the client since. The backend has no room or socket code yet, so a tick
means "answered in writing", not "seen working".


- [x] **Colour choice (FR-06, FR-SYS-01).** Decided 2026-11-21: players choose. The client asked
      for it, and the backend builds to this contract. The host sends `colour` on create, and a
      joiner sends one of the free colours on join, or gets `COLOUR_TAKEN`. A room's colours go
      clockwise from the host's (2 seats: opposite corner; 3: the next two; 4: all). See §1.
- [x] **Room preview.** Decided 2026-11-21: `GET /rooms/{roomCode}` returns the `RoomSnapshot`.
      See §1.
- [x] **Same-device play (FR-03).** Decided 2026-11-21: not needed (the client), so task P13 was
      dropped and the server needn't let one browser hold several sessions.
- [x] `game:state` envelope — nested as `(version, snapshot)` (D3 REQ-G1 2.1,
      step 4).
- [x] `ROLLED` carries the legal moves (D3 REQ-PLAYER 2.1, step 7). They are in
      the snapshot too, and we read them from there.
- [x] CORS for `http://localhost:5173` — it is the default for the backend's
      `CORS_ORIGINS` (Phase 0 `config.ts`, not merged yet).
- [x] `GET /health` — `status` and `version` are strings; `uptimeS`, `rooms` and
      `clients` are numbers. It also sends `v` (Phase 0 `app.ts`, not merged yet).
- [x] `game:restart` — a new match ID and state version 1 (D3 POST-PLAYER 7.1-1),
      so the store treats a new `matchId` as a fresh match. Frontends then get
      `GAME_RESTARTED`, `GAME_STARTED` and `game:state`, with `GAME_ABANDONED`
      first if the match was still running. The mock sends only `GAME_RESTARTED`.
- [x] Rules G-1, G-2, G-3 and G-5 — the text is in D3 §2.3. G-2 differs from the
      mock: see "First player" below.
- [x] **2-player colours (R1).** Red and Yellow (D3 G-1) when the host picks no colour. Since the
      colour choice, the host's colour and the opposite corner (§1).
- [x] **First player (FR-08).** Chosen at random by the server (D3 G-2). Our R2 and the mock both
      say seat 1; the mock keeps seat 1 so tests repeat. The front end never assumes it: it reads
      `turn.activePlayerId`.
- [x] **AI thinking signal (FR-SYS-07).** D3's event list has no such event, so
      we infer it from the active player being an AI.
- [x] **AI difficulty (FR-31).** `EASY` and `NORMAL` (D3 §2.5, marked as a team
      default still to confirm with their Project Owner).

---

## 9. Our side: the `GameAdapter` interface (NFR-SYS-12)

Our D3 (§3.2) says the front end reaches game logic and game AI **only through
an integration adapter**, so either can be swapped without redesigning the UI.
This is that interface. It lives in `src/adapter/GameAdapter.ts`.

```ts
export interface GameAdapter {
  // setup (REST in the LGS implementation)
  createRoom(req: CreateRoomRequest): Promise<Result<CreateRoomResponse>>;
  joinRoom(code: string, req: JoinRoomRequest): Promise<Result<JoinRoomResponse>>;
  previewRoom(code: string): Promise<Result<RoomPreview>>;

  // live session
  connect(sessionToken: string): void;
  disconnect(): void;

  // commands — every one resolves to an Ack, never throws
  addAi(seat: number, difficulty: Difficulty): Promise<Ack>;
  leave(): Promise<Ack>;
  start(opts: { fillEmptySeatsWithAi: boolean; aiDifficulty?: Difficulty }): Promise<Ack>;
  roll(): Promise<Ack>;
  move(pieceId: string): Promise<Ack>;
  restart(): Promise<Ack>;
  sync(knownVersion: number): Promise<Ack>;

  // incoming — returns an unsubscribe function
  on(handlers: AdapterHandlers): () => void;
}

export interface AdapterHandlers {
  onRoom(room: RoomSnapshot): void;
  onState(snapshot: GameStateSnapshot): void;
  onEvent(event: ServerEvent): void;
  onError(error: ServerError): void;
  onConnection(status: ConnectionStatus): void;
  onSessionReplaced(): void;
}

type Result<T> = { ok: true; data: T } | { ok: false; error: ServerError };
```

Implementations:

| Class | Used for |
|---|---|
| `LgsAdapter` | the real backend **and** our mock server (same protocol, different URL) |
| `FakeAdapter` | unit tests — in-memory, scriptable, no network. This is how we prove NFR-SYS-12. |

A `LocalMultiSeatAdapter` for same-device play (task P13) was planned, and dropped on 2026-11-21
(§8).

The store receives a `GameAdapter` when it is created. Nothing else in
`src/` knows which implementation is in use.
