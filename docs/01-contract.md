# 01 — Integration Contract (LGS v1.0.0)

Source of truth: **D3 System Requirements, section 3.4**, written by The Assemblers.
This file is the frontend-side mirror. If this file and the backend's published
`@assemblers/ludo-contract` package disagree, **the package wins** — raise a
GitHub issue on `ZohaibCodez/ludo-multiplayer-backend` and fix this file.

All payloads are JSON (UTF-8). Every server message carries a contract version
field `v` (currently `"1.0.0"`). REST paths are prefixed `/api/v1`.

---

## 1. REST endpoints

Used only before the realtime connection exists: create, join, preview, health.

### POST /api/v1/rooms — create a room

Request body:
```ts
{
  displayName: string;              // 1-20 chars: letters, digits, space, _ - .
  mode: "HUMAN_VS_HUMAN" | "HUMAN_VS_AI";
  seats: 2 | 3 | 4;
  aiDifficulty?: "EASY" | "NORMAL"; // default NORMAL
  rules?: Partial<RuleConfig>;      // see section 5
}
```
Success `201`:
```ts
{ v: string; roomCode: string; playerId: string; sessionToken: string; room: RoomSnapshot }
```
Errors: `400 INVALID_PAYLOAD`, `400 INVALID_NAME`, `400 INVALID_RULES`, `503 SERVER_BUSY`.

Notes:
- The creator is always the **host** and always takes **seat 1 (Red)**.
- In `HUMAN_VS_AI` the other seats are filled with AI players immediately.

### POST /api/v1/rooms/{roomCode}/join — join a room

Request body: `{ displayName: string }`
Success `200`: `{ v, playerId, sessionToken, room }`
Errors: `400 INVALID_CODE`, `404 ROOM_NOT_FOUND`, `409 ROOM_FULL`,
`409 GAME_ALREADY_STARTED`, `409 NAME_TAKEN`, `429 RATE_LIMITED`.

The server upper-cases the code. The client should also upper-case before
sending and strip spaces.

### GET /api/v1/rooms/{roomCode} — preview before joining

Success `200`: public summary — status, mode, host name, free seats.
Error: `404 ROOM_NOT_FOUND`.
Use this to show "Room K7QX2M — 2/4 players, waiting" before the user commits a name.

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
type Ack = { ok: true; version: number } | { ok: false; error: ServerError };
```

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

These are our TypeScript mirrors. Field names must match the backend exactly.
**Confirm every optional/unsure field with the backend's Integration & QA Lead
before building UI on it.**

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
  lastRoll: number | null;       // 1-6
  sixesInRow: number;            // 0-2 (a third six ends the turn)
  legalMoves: LegalMove[];       // non-empty only in AWAITING_MOVE
  deadline: string | null;       // ISO timestamp; null when turnTimerSeconds is 0
}

export interface GameStateSnapshot {
  v: string;
  roomCode: string;
  matchId: string;
  version: number;
  status: RoomStatus;
  rules: RuleConfig;
  players: Player[];
  pieces: Piece[];
  turn: TurnState;
  seedHash: string;
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
3. Connect socket with `auth: { sessionToken }`.
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

## 8. Questions to confirm with the backend team

Keep this list alive. Tick items off as they are answered in writing.

- [ ] Exact JSON envelope of `game:state` — is the snapshot nested under
      `snapshot`, or are its fields at the top level next to `version`?
- [ ] Is `Player.isAi` the real field name, or `isAI` / `type: "AI"`?
- [ ] Does `RoomSnapshot` carry `seats` as an array, or `players` plus a
      separate `seatCount`?
- [ ] `LegalMove.captures` — piece IDs, or full piece objects?
- [ ] Is `deadline` an ISO string or epoch milliseconds?
- [ ] Does `ROLLED` carry the legal moves too, or must we read them from the
      snapshot's `turn.legalMoves`?
- [ ] CORS origin for our dev server (`http://localhost:5173`) — is it allowed?
- [ ] Is the contract package published to npm, or do we vendor the types?
- [ ] `GET /rooms/{roomCode}` preview — what are the exact field names for
      status, mode, host name and free seats? `RoomPreview` stays out of
      `src/contract/types.ts` until we know.
- [ ] `GET /health` — are `status` and `version` strings, and `uptimeS`,
      `rooms` and `clients` numbers? `HealthResponse` assumes so.

From our own D3 (see `docs/00-requirements.md` §5):

- [ ] **Colour choice (FR-06, FR-SYS-01).** Can a player pick their colour or
      seat on create/join? If not, can it be added? Today seat 1 is always red.
- [ ] **Same-device play (FR-03).** May one browser create a room and then
      join it again under other names, holding several session tokens at once?
      Any limit (rate limit, same IP) that would block this?
- [ ] **First player (FR-08).** Is it always seat 1, or highest first roll?
- [ ] **AI thinking signal (FR-SYS-07).** Is there an event when an AI turn
      starts, or do we infer it from `TURN_CHANGED` + `player.isAi`?
- [ ] **AI difficulty (FR-31).** Confirmed: `EASY` and `NORMAL` only?

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
| `LocalMultiSeatAdapter` | task P13 only (TO CONFIRM): wraps several `LgsAdapter`s, one per local seat |

The store receives a `GameAdapter` when it is created. Nothing else in
`src/` knows which implementation is in use.
