// @vitest-environment node

// Runs the real server with real socket.io clients, because acks, handshakes and message order
// are exactly what an in-process fake would hide.

import type { AddressInfo } from "node:net";
import { io as connectSocket, type Socket } from "socket.io-client";
import { defaultRules } from "../src/config/defaultRules";
import type { ServerEvent } from "../src/contract/events";
import type {
  CreateRoomResponse,
  GameStateSnapshot,
  JoinRoomResponse,
  RoomSnapshot,
  ServerError,
} from "../src/contract/types";
import { createMockServer, type MockServer } from "./server";

interface StateMessage {
  v: string;
  version: number;
  snapshot: GameStateSnapshot;
}

interface AckMessage {
  v: string;
  ok: boolean;
  version?: number;
  error?: ServerError;
  requestId?: string;
}

interface Logged {
  event: string;
  payload: unknown;
}

const FAST_RULES = { aiDelayMs: 0, standInDelayMs: 0, turnTimerSeconds: 0 };

class Client {
  readonly log: Logged[] = [];
  private wake: Array<() => void> = [];

  constructor(readonly socket: Socket) {
    socket.onAny((event: string, payload: unknown) => {
      this.log.push({ event, payload });
      this.notify();
    });
  }

  notify(): void {
    for (const resolve of this.wake.splice(0)) resolve();
  }

  send(event: string, payload: object = {}): Promise<AckMessage> {
    return this.socket.emitWithAck(event, payload) as Promise<AckMessage>;
  }

  states(): StateMessage[] {
    return this.log
      .filter(({ event }) => event === "game:state")
      .map(({ payload }) => {
        return payload as StateMessage;
      });
  }

  events(): ServerEvent[] {
    return this.log
      .filter(({ event }) => event === "game:event")
      .map(({ payload }) => {
        return payload as ServerEvent;
      });
  }

  latest(): GameStateSnapshot {
    const state = this.states().at(-1);
    if (!state) throw new Error("No game:state received yet");
    return state.snapshot;
  }

  /** Waits until `check` passes, re-testing after every message from the server. */
  async until(check: () => boolean, label: string, timeoutMs = 4000): Promise<void> {
    const giveUpAt = Date.now() + timeoutMs;
    while (!check()) {
      const remaining = giveUpAt - Date.now();
      if (remaining <= 0) throw new Error(`Timed out waiting for ${label}`);
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, remaining);
        this.wake.push(() => {
          clearTimeout(timer);
          resolve();
        });
      });
    }
  }

  untilEvent(type: string): Promise<void> {
    return this.until(() => this.events().some((event) => event.type === type), type);
  }

  untilState(check: (snapshot: GameStateSnapshot) => boolean, label: string): Promise<void> {
    return this.until(() => {
      const state = this.states().at(-1);
      return state !== undefined && check(state.snapshot);
    }, label);
  }

  close(): void {
    this.socket.disconnect();
  }
}

let server: MockServer | null = null;
let baseUrl = "";
const clients: Client[] = [];

async function startServer(debug: boolean): Promise<void> {
  server = createMockServer({ debug, timing: { passDelayMs: 0 } });
  const running = server.httpServer;
  await new Promise<void>((resolve) => running.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${(running.address() as AddressInfo).port}`;
}

async function request(method: string, path: string, body?: unknown) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}

async function createRoom(overrides: object = {}): Promise<CreateRoomResponse> {
  const response = await request("POST", "/api/v1/rooms", {
    displayName: "Host",
    mode: "HUMAN_VS_AI",
    seats: 4,
    rules: FAST_RULES,
    ...overrides,
  });
  expect(response.status).toBe(201);
  return response.body as unknown as CreateRoomResponse;
}

async function joinRoom(code: string, displayName: string): Promise<JoinRoomResponse> {
  const response = await request("POST", `/api/v1/rooms/${code}/join`, { displayName });
  expect(response.status).toBe(200);
  return response.body as unknown as JoinRoomResponse;
}

async function connect(sessionToken: string): Promise<Client> {
  const socket = connectSocket(baseUrl, {
    auth: { sessionToken },
    transports: ["websocket"],
    autoConnect: false,
    reconnection: false,
    forceNew: true,
  });
  const client = new Client(socket);
  clients.push(client);
  await new Promise<void>((resolve, reject) => {
    socket.once("connect", () => resolve());
    socket.once("connect_error", reject);
    socket.connect();
  });
  return client;
}

async function debugPost(path: string, body: object) {
  const response = await request("POST", `/debug/${path}`, body);
  expect(response.status).toBe(200);
  return response.body;
}

afterEach(async () => {
  for (const client of clients.splice(0)) client.close();
  const running = server;
  server = null;
  if (running) await running.io.close();
});

describe("REST", () => {
  beforeEach(() => startServer(false));

  it("creates a room in the documented shape", async () => {
    const created = await createRoom();
    expect(Object.keys(created).sort()).toEqual(
      ["playerId", "room", "roomCode", "sessionToken", "v"].sort(),
    );
    expect(created.v).toBe("1.0.0");
    expect(created.roomCode).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);
    expect(created.room.seats.map(({ colour }) => colour)).toEqual([
      "RED",
      "GREEN",
      "YELLOW",
      "BLUE",
    ]);
    expect(created.room.seats[0]?.player).toMatchObject({ name: "Host", isHost: true });
    expect(created.room.seats[1]?.player?.isAi).toBe(true);
  });

  it.each([
    [2, ["RED", "YELLOW"]],
    [3, ["RED", "GREEN", "YELLOW"]],
    [4, ["RED", "GREEN", "YELLOW", "BLUE"]],
  ])("gives %i seats the right colours (R1)", async (seats, colours) => {
    const created = await createRoom({ seats });
    expect(created.room.seats.map(({ colour }) => colour)).toEqual(colours);
  });

  it("never puts a session token in a room snapshot", async () => {
    const created = await createRoom();
    expect(JSON.stringify(created.room)).not.toContain(created.sessionToken);
  });

  it("joins a room, ignoring case and spaces in the code", async () => {
    const created = await createRoom({ mode: "HUMAN_VS_HUMAN", seats: 2 });
    const messy = ` ${created.roomCode.toLowerCase().slice(0, 3)} ${created.roomCode
      .toLowerCase()
      .slice(3)} `;
    const joined = await joinRoom(encodeURIComponent(messy), "Guest");
    expect(Object.keys(joined).sort()).toEqual(["playerId", "room", "sessionToken", "v"].sort());
    expect(joined.room.seats[1]?.player).toMatchObject({ name: "Guest", colour: "YELLOW" });
  });

  it("previews a room and reports health", async () => {
    const created = await createRoom();
    const preview = await request("GET", `/api/v1/rooms/${created.roomCode}`);
    expect(preview.status).toBe(200);
    expect(preview.body).toMatchObject({ status: "LOBBY", mode: "HUMAN_VS_AI" });

    const health = await request("GET", "/api/v1/health");
    expect(health.status).toBe(200);
    expect(health.body).toMatchObject({ status: "ok", rooms: 1, clients: 0, version: "1.0.0" });
    expect(health.body.uptimeS).toEqual(expect.any(Number));
  });

  it.each([
    ["a bad name", { displayName: "<bad>" }, 400, "INVALID_NAME"],
    ["a bad mode", { mode: "SOLO" }, 400, "INVALID_PAYLOAD"],
    ["bad seats", { seats: 5 }, 400, "INVALID_PAYLOAD"],
    ["a bad rule value", { rules: { aiDelayMs: 99999 } }, 400, "INVALID_RULES"],
    ["an unknown rule", { rules: { constructor: 1 } }, 400, "INVALID_RULES"],
  ])("refuses to create a room with %s", async (_label, overrides, status, code) => {
    const response = await request("POST", "/api/v1/rooms", {
      displayName: "Host",
      mode: "HUMAN_VS_AI",
      seats: 4,
      ...overrides,
    });
    expect(response.status).toBe(status);
    expect(response.body).toMatchObject({ v: "1.0.0", code });
  });

  it("answers malformed JSON with INVALID_PAYLOAD", async () => {
    const response = await fetch(`${baseUrl}/api/v1/rooms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{not json",
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "INVALID_PAYLOAD" });
  });

  it("uses the contract's join errors", async () => {
    const created = await createRoom({ mode: "HUMAN_VS_HUMAN", seats: 2 });
    const join = (code: string, displayName: string) =>
      request("POST", `/api/v1/rooms/${code}/join`, { displayName });

    expect((await join("ABC", "Guest")).body.code).toBe("INVALID_CODE");
    expect((await join("I0O1LX", "Guest")).body.code).toBe("INVALID_CODE");
    expect((await join("AAAAAA", "Guest")).body.code).toBe("ROOM_NOT_FOUND");
    expect((await join(created.roomCode, "host")).body.code).toBe("NAME_TAKEN");

    await joinRoom(created.roomCode, "Guest");
    expect((await join(created.roomCode, "Third")).body.code).toBe("ROOM_FULL");

    const started = await createRoom({ seats: 2 });
    const host = await connect(started.sessionToken);
    await host.send("game:start", { fillEmptySeatsWithAi: true });
    expect((await join(started.roomCode, "Late")).body.code).toBe("GAME_ALREADY_STARTED");
  });

  it("has no debug routes unless debug mode is on", async () => {
    for (const path of ["force-roll", "scenario", "rules"]) {
      const response = await fetch(`${baseUrl}/debug/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: 6, name: "near-win" }),
      });
      expect(response.status).toBe(404);
    }
  });
});

describe("sockets", () => {
  beforeEach(() => startServer(true));

  it("refuses a bad token with UNAUTHORIZED", async () => {
    await expect(connect("not-a-real-token")).rejects.toMatchObject({
      message: "UNAUTHORIZED",
      data: { code: "UNAUTHORIZED" },
    });
  });

  it("sends the room on connect, and the game too if one is running", async () => {
    const created = await createRoom();
    const first = await connect(created.sessionToken);
    await first.until(() => first.log.some(({ event }) => event === "room:updated"), "room");
    await first.send("game:start", { fillEmptySeatsWithAi: true });
    await debugPost("force-roll", { value: 6 });

    const second = await connect(created.sessionToken);
    await second.until(() => second.states().length > 0, "game state");
    const events = second.log.map(({ event }) => event);
    expect(events.indexOf("room:updated")).toBeLessThan(events.lastIndexOf("game:state"));
  });

  it("acknowledges with version, v and the echoed requestId", async () => {
    const created = await createRoom();
    const host = await connect(created.sessionToken);
    const ack = await host.send("game:start", {
      fillEmptySeatsWithAi: true,
      requestId: "start-1",
    });
    expect(ack).toEqual({ v: "1.0.0", ok: true, version: 1, requestId: "start-1" });
  });

  it("sends each event before the state with the same version", async () => {
    const created = await createRoom({ mode: "HUMAN_VS_HUMAN", seats: 2 });
    const guest = await joinRoom(created.roomCode, "Guest");
    const host = await connect(created.sessionToken);
    const other = await connect(guest.sessionToken);

    await host.send("game:start", { fillEmptySeatsWithAi: false });
    await debugPost("force-roll", { value: 6 });
    await host.send("game:roll");
    await host.send("game:move", { pieceId: "R1" });
    await other.untilState(({ version }) => version === 3, "version 3");

    const stream = other.log.filter(({ event }) => event.startsWith("game:"));
    let lastVersion = 0;
    let pendingEventVersion: number | null = null;
    for (const { event, payload } of stream) {
      const message = payload as { version: number; v: string };
      expect(message.v).toBe("1.0.0");
      if (event === "game:event") {
        pendingEventVersion = message.version;
      } else {
        expect(message.version).toBe(lastVersion + 1);
        if (pendingEventVersion !== null) expect(pendingEventVersion).toBe(message.version);
        lastVersion = message.version;
        pendingEventVersion = null;
      }
    }
    expect(lastVersion).toBe(3);
    expect(other.events().map(({ type }) => type)).toEqual([
      "GAME_STARTED",
      "ROLLED",
      "MOVED",
      "BONUS_TURN",
    ]);
  });

  it("shows every state to both players", async () => {
    const created = await createRoom({ mode: "HUMAN_VS_HUMAN", seats: 2 });
    const guest = await joinRoom(created.roomCode, "Guest");
    const host = await connect(created.sessionToken);
    const other = await connect(guest.sessionToken);

    await host.send("game:start", { fillEmptySeatsWithAi: false });
    await debugPost("scenario", { name: "capture-ready" }); // puts a piece on the board for each
    await debugPost("force-roll", { value: 2 }); // replaces the scenario's 1: no capture, no bonus
    await host.send("game:roll");
    const [firstMove] = host.latest().turn.legalMoves;
    if (!firstMove) throw new Error("Expected a legal move");
    await host.send("game:move", { pieceId: firstMove.pieceId });
    const { version } = await other.send("game:roll");

    expect(version).toBe(5); // start, scenario, roll, move, roll
    await Promise.all(
      [host, other].map((client) =>
        client.untilState((snapshot) => snapshot.version === version, "the last state"),
      ),
    );
    expect(other.states()).toEqual(host.states());
  });

  it("changes nothing when a command is refused (FR-SYS-04)", async () => {
    const created = await createRoom({ mode: "HUMAN_VS_HUMAN", seats: 2 });
    const guest = await joinRoom(created.roomCode, "Guest");
    const host = await connect(created.sessionToken);
    const other = await connect(guest.sessionToken);

    const notHost = await other.send("game:start", { fillEmptySeatsWithAi: true });
    expect(notHost.error?.code).toBe("NOT_HOST");

    await host.send("game:start", { fillEmptySeatsWithAi: false });
    await debugPost("force-roll", { value: 6 });
    await host.until(() => host.states().length === 1, "first state");
    const before = host.latest();

    const wrongTurn = await other.send("game:roll", { requestId: "r-1" });
    expect(wrongTurn).toMatchObject({
      v: "1.0.0",
      ok: false,
      requestId: "r-1",
      error: { code: "NOT_YOUR_TURN", requestId: "r-1" },
    });
    expect((await host.send("game:move", { pieceId: "R1" })).error?.code).toBe("ROLL_REQUIRED");
    expect(host.latest()).toEqual(before);

    await host.send("game:roll");
    const version = host.latest().version;
    expect((await host.send("game:move", { pieceId: "Z9" })).error?.code).toBe("PIECE_NOT_FOUND");
    const illegal = await host.send("game:move", { pieceId: "Y1" });
    expect(illegal.error).toMatchObject({
      code: "ILLEGAL_MOVE",
      message: "That piece belongs to another player.",
    });
    expect(host.latest().version).toBe(version);
  });

  it("re-sends the legal moves on ALREADY_ROLLED", async () => {
    const created = await createRoom();
    const host = await connect(created.sessionToken);
    await host.send("game:start", { fillEmptySeatsWithAi: true });
    await debugPost("force-roll", { value: 6 });
    await host.send("game:roll");
    await host.untilState(({ version }) => version === 2, "the roll");
    const count = host.states().length;

    const second = await host.send("game:roll");
    expect(second.error?.code).toBe("ALREADY_ROLLED");
    await host.until(() => host.states().length === count + 1, "re-sent state");
    expect(host.latest().version).toBe(2);
    expect(host.latest().turn.legalMoves).toHaveLength(4);
  });

  it("reports a failed command that has no ack through the error message", async () => {
    const created = await createRoom();
    const host = await connect(created.sessionToken);

    host.socket.emit("game:roll", { requestId: "no-ack" });
    await host.until(() => host.log.some(({ event }) => event === "error"), "an error message");
    expect(host.log.find(({ event }) => event === "error")?.payload).toMatchObject({
      v: "1.0.0",
      code: "GAME_NOT_STARTED",
      requestId: "no-ack",
    });
  });

  it("sends only the fields the contract names", async () => {
    const created = await createRoom();
    const host = await connect(created.sessionToken);
    await host.send("game:start", { fillEmptySeatsWithAi: true });
    await debugPost("force-roll", { value: 6 });
    await host.send("game:roll");
    await host.untilState(({ turn }) => turn.legalMoves.length > 0, "the roll");

    const keys = (value: object | undefined): string[] => Object.keys(value ?? {}).sort();
    const snapshot = host.latest();
    const room = host.log.filter(({ event }) => event === "room:updated").at(-1)?.payload as object;

    expect(keys(room)).toEqual(["hostId", "mode", "roomCode", "rules", "seats", "status", "v"]);
    expect(keys(host.states()[0])).toEqual(["snapshot", "v", "version"]);
    expect(keys(host.events()[0])).toEqual(["data", "type", "v", "version"]);
    expect(keys(snapshot)).toEqual([
      "matchId",
      "pieces",
      "players",
      "roomCode",
      "rules",
      "seedHash",
      "status",
      "turn",
      "v",
      "version",
    ]);
    expect(keys(snapshot.rules)).toEqual(keys(defaultRules));
    expect(keys(snapshot.turn)).toEqual([
      "activePlayerId",
      "deadline",
      "lastRoll",
      "legalMoves",
      "phase",
      "sixesInRow",
    ]);
    expect(keys(snapshot.players[0])).toEqual([
      "colour",
      "connected",
      "id",
      "isAi",
      "isHost",
      "name",
      "piecesHome",
    ]);
    expect(keys(snapshot.pieces[0])).toEqual(["boardSquare", "colour", "id", "step"]);
    expect(keys(snapshot.turn.legalMoves[0])).toEqual([
      "captures",
      "fromStep",
      "pieceId",
      "toStep",
    ]);
  });

  it("refuses bad payloads and starting alone", async () => {
    const created = await createRoom({ mode: "HUMAN_VS_HUMAN", seats: 2 });
    const host = await connect(created.sessionToken);

    const noFlag = await host.send("game:start");
    expect(noFlag.error?.code).toBe("INVALID_PAYLOAD");
    const alone = await host.send("game:start", { fillEmptySeatsWithAi: false });
    expect(alone.error?.code).toBe("NOT_ENOUGH_PLAYERS");
    const huge = await host.send("state:sync", { knownVersion: 0, padding: "x".repeat(5000) });
    expect(huge.error?.code).toBe("INVALID_PAYLOAD");
  });

  it("adds a computer player to a free seat", async () => {
    const created = await createRoom({ mode: "HUMAN_VS_HUMAN", seats: 3 });
    const host = await connect(created.sessionToken);
    const ack = await host.send("room:addAi", { seat: 2, difficulty: "EASY" });
    expect(ack).toMatchObject({ ok: true, version: 0 });

    const room = host.log.filter(({ event }) => event === "room:updated").at(-1)
      ?.payload as RoomSnapshot;
    expect(room.seats[1]?.player?.isAi).toBe(true);
    expect((await host.send("room:addAi", { seat: 2, difficulty: "EASY" })).error?.code).toBe(
      "INVALID_PAYLOAD",
    );
  });

  it("limits a connection to 20 commands a second", async () => {
    const created = await createRoom();
    const host = await connect(created.sessionToken);
    const acks = await Promise.all(
      Array.from({ length: 25 }, () => host.send("state:sync", { knownVersion: 0 })),
    );
    expect(acks.filter(({ ok }) => ok).length).toBeLessThanOrEqual(20);
    expect(acks.some(({ error }) => error?.code === "RATE_LIMITED")).toBe(true);
  });

  it("tells the old tab it was replaced, without marking the player away", async () => {
    const created = await createRoom();
    const first = await connect(created.sessionToken);
    await first.send("game:start", { fillEmptySeatsWithAi: true });
    await debugPost("force-roll", { value: 3 });

    const second = await connect(created.sessionToken);
    await first.until(
      () => first.log.some(({ event }) => event === "session:replaced"),
      "session:replaced",
    );
    await second.until(() => second.states().length > 0, "state in the new tab");
    expect(first.log.find(({ event }) => event === "session:replaced")?.payload).toEqual({
      v: "1.0.0",
    });
    expect(second.latest().players[0]?.connected).toBe(true);
    expect(second.events().map(({ type }) => type)).not.toContain("PLAYER_DISCONNECTED");
    expect((await second.send("state:sync", { knownVersion: 0 })).ok).toBe(true);
  });

  it("answers state:sync with the full state", async () => {
    const created = await createRoom();
    const host = await connect(created.sessionToken);
    await host.send("game:start", { fillEmptySeatsWithAi: true });
    await host.until(() => host.states().length === 1, "first state");

    const ack = await host.send("state:sync", { knownVersion: 0 });
    expect(ack).toMatchObject({ ok: true, version: host.latest().version });
    await host.until(() => host.states().length === 2, "synced state");
  });

  it("ends the session when a player leaves", async () => {
    const created = await createRoom({ mode: "HUMAN_VS_HUMAN", seats: 2 });
    const guest = await joinRoom(created.roomCode, "Guest");
    await connect(created.sessionToken);
    const other = await connect(guest.sessionToken);

    expect((await other.send("room:leave")).ok).toBe(true);
    expect((await other.send("state:sync", { knownVersion: 0 })).error?.code).toBe("UNAUTHORIZED");
  });
});

describe("debug helpers", () => {
  beforeEach(() => startServer(true));

  async function startedGame() {
    const created = await createRoom();
    const host = await connect(created.sessionToken);
    await host.send("game:start", { fillEmptySeatsWithAi: true });
    return { created, host };
  }

  it("near-win finishes the game on the next roll", async () => {
    const { host } = await startedGame();
    await debugPost("scenario", { name: "near-win" });
    await host.untilState(({ pieces }) => pieces.some(({ step }) => step === 54), "near-win");

    await host.send("game:roll");
    await host.untilState(({ turn }) => turn.legalMoves.length === 1, "the winning move");
    await host.send("game:move", { pieceId: "R4" });
    await host.untilEvent("GAME_OVER");

    const snapshot = host.latest();
    expect(snapshot.status).toBe("FINISHED");
    expect(snapshot.winnerId).toBe(snapshot.players[0]?.id);
    expect(snapshot.seed).toEqual(expect.any(String));
  });

  it("capture-ready captures on the next roll", async () => {
    const { host } = await startedGame();
    await debugPost("scenario", { name: "capture-ready" });
    await host.send("game:roll");
    await host.untilState(({ turn }) => turn.phase === "AWAITING_MOVE", "the roll");

    const move = host.latest().turn.legalMoves.find(({ captures }) => captures.length === 1);
    if (!move) throw new Error("Expected a capturing move");
    await host.send("game:move", { pieceId: move.pieceId });
    await host.untilEvent("CAPTURED");
    const capturedId = move.captures[0];
    expect(host.latest().pieces.find(({ id }) => id === capturedId)?.step).toBe(0);
  });

  it("three-sixes forfeits on the next roll", async () => {
    const { host } = await startedGame();
    await debugPost("scenario", { name: "three-sixes" });
    await host.untilState(({ turn }) => turn.sixesInRow === 2, "two sixes");
    await host.send("game:roll");
    await host.untilEvent("TURN_FORFEITED");
  });

  it("no-legal-move passes the turn", async () => {
    const { host } = await startedGame();
    await debugPost("scenario", { name: "no-legal-move" });
    await host.send("game:roll");
    await host.untilEvent("TURN_PASSED");
  });

  it("force-roll holds until it is cleared", async () => {
    const { created, host } = await startedGame();
    const forced = await debugPost("force-roll", { value: 4 });
    expect(forced).toMatchObject({ roomCode: created.roomCode, forcedRoll: 4 });
    await host.send("game:roll");
    await host.untilState(({ turn }) => turn.lastRoll === 4, "a forced 4");

    expect(await debugPost("force-roll", { value: null })).toMatchObject({ forcedRoll: null });
    const refused = await request("POST", "/debug/force-roll", { value: 7 });
    expect(refused.status).toBe(400);
  });

  it("rules apply to the next match, and bad rules are refused", async () => {
    const created = await createRoom();
    const host = await connect(created.sessionToken);
    const response = await debugPost("rules", { safeSquares: [1, 2, 3] });
    expect(response).toMatchObject({ rules: { safeSquares: [1, 2, 3] } });

    await host.send("game:start", { fillEmptySeatsWithAi: true });
    await host.untilState(() => true, "first state");
    expect(host.latest().rules.safeSquares).toEqual([1, 2, 3]);

    const refused = await request("POST", "/debug/rules", { aiDelayMs: -1 });
    expect(refused.body.code).toBe("INVALID_RULES");
  });

  it("refuses an unknown scenario, and any scenario before a game", async () => {
    await createRoom();
    const unknown = await request("POST", "/debug/scenario", { name: "nope" });
    expect(unknown.body.code).toBe("INVALID_PAYLOAD");
    const early = await request("POST", "/debug/scenario", { name: "near-win" });
    expect(early.body.code).toBe("GAME_NOT_STARTED");
  });
});

describe("whole games over real sockets", () => {
  beforeEach(() => startServer(false));

  it(
    "a script playing seat 1 against 3 computers reaches a winner",
    { timeout: 30000 },
    async () => {
      const created = await createRoom();
      const host = await connect(created.sessionToken);
      let actedOnVersion = 0;
      const refusals: string[] = [];
      // The script plays faster than a person, so it backs off when told to, as the client must.
      const act = (event: string, payload: object = {}): void => {
        void host.send(event, payload).then(({ error }) => {
          if (error?.code === "RATE_LIMITED") setTimeout(() => act(event, payload), 100);
          else if (error) refusals.push(error.code);
        });
      };

      host.socket.on("game:state", ({ version, snapshot }: StateMessage) => {
        const { turn, status } = snapshot;
        if (status !== "IN_PROGRESS" || turn.activePlayerId !== created.playerId) return;
        if (version <= actedOnVersion) return;
        if (turn.phase === "AWAITING_ROLL") {
          actedOnVersion = version;
          act("game:roll");
        } else if (turn.legalMoves[0]) {
          actedOnVersion = version;
          act("game:move", { pieceId: turn.legalMoves[0].pieceId });
        }
      });

      expect((await host.send("game:start", { fillEmptySeatsWithAi: true })).ok).toBe(true);
      await host.until(
        () => host.events().some(({ type }) => type === "GAME_OVER"),
        "GAME_OVER",
        28000,
      );
      expect(refusals).toEqual([]);

      const snapshot = host.latest();
      expect(snapshot.status).toBe("FINISHED");
      expect(snapshot.ranking?.[0]).toBe(snapshot.winnerId);
      expect(snapshot.seed).toEqual(expect.any(String));
      expect(snapshot.players.find(({ id }) => id === snapshot.winnerId)?.piecesHome).toBe(4);

      const versions = host.states().map(({ version }) => version);
      expect(versions).toEqual(versions.map((_, index) => index + 1));
    },
  );

  it(
    "computers and a stand-in finish the game after the host disconnects",
    { timeout: 30000 },
    async () => {
      const created = await createRoom();
      const host = await connect(created.sessionToken);
      await host.send("game:start", { fillEmptySeatsWithAi: true });
      host.close();

      const giveUpAt = Date.now() + 28000;
      let status = "IN_PROGRESS";
      while (status !== "FINISHED") {
        if (Date.now() > giveUpAt) throw new Error("The game never finished");
        await new Promise((resolve) => setTimeout(resolve, 50));
        const preview = await request("GET", `/api/v1/rooms/${created.roomCode}`);
        status = String(preview.body.status);
      }

      const back = await connect(created.sessionToken);
      await back.untilState(({ status: current }) => current === "FINISHED", "the finished game");
      expect(back.latest().winnerId).toEqual(expect.any(String));
    },
  );
});
