// Rooms, seats, sessions and the clock. Rules live in game.ts; this file decides when they run
// and tells every player what happened.

import { randomBytes, randomInt, randomUUID } from "node:crypto";
import type { EventType } from "../src/contract/events";
import type {
  CreateRoomRequest,
  CreateRoomResponse,
  Difficulty,
  GameMode,
  JoinRoomResponse,
  Player,
  RoomSnapshot,
  RoomStatus,
  RuleConfig,
} from "../src/contract/types";
import { chooseMove } from "./ai";
import {
  activePlayer,
  applyMove,
  applyRoll,
  COLOUR_ORDER,
  CommandError,
  CONTRACT_VERSION,
  createMatch,
  DEFAULT_RULES,
  drawDie,
  passTurn,
  requireLegalMove,
  requireTurn,
  toSnapshot,
  type Match,
} from "./game";

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;
const CODE_PATTERN = new RegExp(`^[${CODE_ALPHABET}]{${CODE_LENGTH}}$`);
const NAME_PATTERN = /^[\p{L}\p{N} _.-]{1,20}$/u;
const MIN_PLAYERS = 2;

export interface Outbox {
  toRoom(roomCode: string, event: string, payload: unknown): void;
  toSocket(socketId: string, event: string, payload: unknown): void;
  dropSocket(socketId: string): void;
  evictRoom(roomCode: string): void;
}

export interface Timing {
  passDelayMs: number; // how long a roll with no legal move stays on screen (G-10)
  absenceMs: number; // how long someone may be away before their seat or room is lost
}

export interface Session {
  token: string;
  playerId: string;
  roomCode: string;
  socketId: string | null;
}

export interface Room {
  code: string;
  status: RoomStatus;
  mode: GameMode;
  rules: RuleConfig; // used by the next match; a running match keeps its own copy
  hostId: string;
  seats: RoomSnapshot["seats"];
  aiDifficulty: Difficulty;
  aiLevels: Map<string, Difficulty>;
  match: Match | null;
  forcedRoll: number | null;
  scriptedRolls: number[];
  autoplayFor: string | null; // a human who ran out of time; the computer ends their turn
  turnTimer: NodeJS.Timeout | null;
  closeTimer: NodeJS.Timeout | null;
  dropTimers: Map<string, NodeJS.Timeout>;
}

export function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new CommandError("INVALID_PAYLOAD", "That request was not in the right format.");
  }
  return value as Record<string, unknown>;
}

type RuleCheck = (value: unknown) => boolean;

const isBoolean: RuleCheck = (value) => typeof value === "boolean";
const isWholeBetween =
  (min: number, max: number): RuleCheck =>
  (value) =>
    typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;

// A Map, because a plain object would treat a key like "constructor" as a known rule.
const RULE_CHECKS = new Map<string, RuleCheck>(
  Object.entries({
    turnTimerSeconds: (value) => value === 0 || isWholeBetween(10, 120)(value),
    threeSixesForfeit: isBoolean,
    bonusOnSix: isBoolean,
    bonusOnCapture: isBoolean,
    bonusOnFinish: isBoolean,
    safeSquares: (value) => Array.isArray(value) && value.every(isWholeBetween(0, 51)),
    autoMoveSingleOption: isBoolean,
    aiDelayMs: isWholeBetween(0, 2000),
    standInDelayMs: isWholeBetween(0, 10000),
  } satisfies Record<keyof RuleConfig, RuleCheck>),
);

export function parseRules(value: unknown): Partial<RuleConfig> {
  if (value === undefined) return {};
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new CommandError("INVALID_RULES", "Those game rules were not in the right format.");
  }
  for (const [key, raw] of Object.entries(value)) {
    if (!RULE_CHECKS.get(key)?.(raw)) {
      // The key comes from the request, and contract §5 caps a message at 120 characters.
      const shortKey = key.slice(0, 40);
      throw new CommandError("INVALID_RULES", `The rule "${shortKey}" has a value we can't use.`);
    }
  }
  return value as Partial<RuleConfig>;
}

function parseName(value: unknown): string {
  const name = typeof value === "string" ? value.trim() : "";
  if (!NAME_PATTERN.test(name)) {
    throw new CommandError(
      "INVALID_NAME",
      "Names can be 1 to 20 letters or numbers, with spaces, _ - or .",
    );
  }
  return name;
}

function parseDifficulty(value: unknown): Difficulty {
  if (value === "EASY" || value === "NORMAL") return value;
  throw new CommandError("INVALID_PAYLOAD", "Computer players can be EASY or NORMAL.");
}

function parseCreateRequest(body: unknown): Required<CreateRoomRequest> {
  const input = asRecord(body);
  const displayName = parseName(input.displayName);
  const { mode, seats } = input;
  if (mode !== "HUMAN_VS_HUMAN" && mode !== "HUMAN_VS_AI") {
    throw new CommandError("INVALID_PAYLOAD", "Please choose a game mode.");
  }
  if (seats !== 2 && seats !== 3 && seats !== 4) {
    throw new CommandError("INVALID_PAYLOAD", "A game needs 2, 3 or 4 seats.");
  }
  return {
    displayName,
    mode,
    seats,
    aiDifficulty: parseDifficulty(input.aiDifficulty ?? "NORMAL"),
    rules: parseRules(input.rules),
  };
}

function normaliseCode(value: string): string {
  return value.replace(/\s+/g, "").toUpperCase();
}

function seatedPlayers(room: Room): Player[] {
  return room.seats.flatMap(({ player }) => (player ? [player] : []));
}

function humansIn(room: Room): Player[] {
  return seatedPlayers(room).filter((player) => !player.isAi);
}

function currentVersion(room: Room): number {
  // Lobby commands have no match yet, and versions start at 1 per match.
  return room.match?.version ?? 0;
}

function stateMessage(match: Match): unknown {
  return { v: CONTRACT_VERSION, version: match.version, snapshot: toSnapshot(match) };
}

function toRoomSnapshot(room: Room): RoomSnapshot {
  return structuredClone({
    v: CONTRACT_VERSION,
    roomCode: room.code,
    status: room.status,
    mode: room.mode,
    rules: room.rules,
    hostId: room.hostId,
    seats: room.seats,
  });
}

export class RoomRegistry {
  private readonly rooms = new Map<string, Room>();
  private readonly sessions = new Map<string, Session>();
  private newestRoomCode: string | null = null;

  constructor(
    private readonly outbox: Outbox,
    private readonly timing: Timing,
  ) {}

  roomCount(): number {
    return this.rooms.size;
  }

  sessionForToken(token: string): Session | undefined {
    return this.sessions.get(token);
  }

  // ---- REST ----

  createRoom(body: unknown): CreateRoomResponse {
    const request = parseCreateRequest(body);
    const room = this.newRoom(request);
    const hostSlot = room.seats[0];
    if (!hostSlot) throw new Error("A room always has a first seat");

    const host = this.seatPlayer(hostSlot, request.displayName, false);
    host.isHost = true;
    room.hostId = host.id;
    if (request.mode === "HUMAN_VS_AI") this.fillWithComputers(room, request.aiDifficulty);

    const session = this.newSession(room, host);
    this.armCloseIfDeserted(room);
    return {
      v: CONTRACT_VERSION,
      roomCode: room.code,
      playerId: host.id,
      sessionToken: session.token,
      room: toRoomSnapshot(room),
    };
  }

  joinRoom(rawCode: string, body: unknown): JoinRoomResponse {
    const code = normaliseCode(rawCode);
    if (!CODE_PATTERN.test(code)) {
      throw new CommandError("INVALID_CODE", "Room codes are 6 letters and numbers.");
    }
    const displayName = parseName(asRecord(body).displayName);
    const room = this.requireRoom(code);
    if (room.status !== "LOBBY") {
      throw new CommandError("GAME_ALREADY_STARTED", "That game has already started.");
    }
    const slot = room.seats.find(({ player }) => player === null);
    if (!slot) throw new CommandError("ROOM_FULL", "That room is full.");

    const lowerName = displayName.toLowerCase();
    if (seatedPlayers(room).some(({ name }) => name.toLowerCase() === lowerName)) {
      throw new CommandError("NAME_TAKEN", "Someone in that room already has that name.");
    }

    const player = this.seatPlayer(slot, displayName, false);
    const session = this.newSession(room, player);
    this.broadcastRoom(room);
    return {
      v: CONTRACT_VERSION,
      playerId: player.id,
      sessionToken: session.token,
      room: toRoomSnapshot(room),
    };
  }

  previewRoom(rawCode: string): RoomSnapshot {
    return toRoomSnapshot(this.requireRoom(normaliseCode(rawCode)));
  }

  // ---- connection ----

  connect(session: Session, socketId: string): void {
    const room = this.roomOf(session);
    const previous = session.socketId;
    session.socketId = socketId; // set first, so the old socket's disconnect is seen as stale
    if (previous !== null && previous !== socketId) {
      this.outbox.toSocket(previous, "session:replaced", { v: CONTRACT_VERSION });
      this.outbox.dropSocket(previous);
    }

    const player = this.playerOf(room, session);
    const wasAway = !player.connected;
    player.connected = true;
    this.clearDropTimer(room, player.id);
    this.armCloseIfDeserted(room);

    if (wasAway && room.match?.status === "IN_PROGRESS") {
      this.commit(room, room.match, ["PLAYER_RECONNECTED"]);
    }
    this.broadcastRoom(room);
    if (room.match) this.outbox.toSocket(socketId, "game:state", stateMessage(room.match));
  }

  disconnect(session: Session, socketId: string): void {
    if (session.socketId !== socketId) return; // a newer tab took over, so they never left
    session.socketId = null;
    const room = this.rooms.get(session.roomCode);
    if (!room) return;

    const player = this.playerOf(room, session);
    player.connected = false;

    if (room.status === "LOBBY") {
      room.dropTimers.set(
        player.id,
        this.after(this.timing.absenceMs, () => this.removeHuman(room, session)),
      );
    } else if (room.match?.status === "IN_PROGRESS") {
      this.commit(room, room.match, ["PLAYER_DISCONNECTED"]);
    }
    this.broadcastRoom(room);
    this.armCloseIfDeserted(room);
  }

  // ---- commands (each returns the version to acknowledge) ----

  addAi(session: Session, payload: Record<string, unknown>): number {
    const room = this.requireLobbyHost(session);
    const difficulty = parseDifficulty(payload.difficulty);
    const slot = room.seats.find(({ seat }) => seat === payload.seat);
    if (!slot || slot.player) {
      throw new CommandError("INVALID_PAYLOAD", "That seat isn't free.");
    }
    this.seatComputer(room, slot, difficulty);
    this.broadcastRoom(room);
    return currentVersion(room);
  }

  leave(session: Session): number {
    const room = this.roomOf(session);
    this.removeHuman(room, session);
    return currentVersion(room);
  }

  start(session: Session, payload: Record<string, unknown>): number {
    const room = this.requireLobbyHost(session);
    if (typeof payload.fillEmptySeatsWithAi !== "boolean") {
      throw new CommandError("INVALID_PAYLOAD", "That request was not in the right format.");
    }
    const difficulty = parseDifficulty(payload.aiDifficulty ?? room.aiDifficulty);
    if (payload.fillEmptySeatsWithAi) this.fillWithComputers(room, difficulty);
    return this.beginMatch(room, "GAME_STARTED");
  }

  roll(session: Session): number {
    const room = this.roomOf(session);
    const match = requireTurn(room.match, session.playerId);
    if (match.turn.phase !== "AWAITING_ROLL") {
      // Contract §6: this error re-sends the legal moves, so the client can just render them.
      if (session.socketId) {
        this.outbox.toSocket(session.socketId, "game:state", stateMessage(match));
      }
      throw new CommandError("ALREADY_ROLLED", "You already rolled. Pick a piece to move.");
    }
    room.autoplayFor = null;
    this.commit(room, match, applyRoll(match, this.nextRoll(room, match)));
    return match.version;
  }

  move(session: Session, payload: Record<string, unknown>): number {
    if (typeof payload.pieceId !== "string") {
      throw new CommandError("INVALID_PAYLOAD", "That request was not in the right format.");
    }
    const room = this.roomOf(session);
    const { match, move } = requireLegalMove(room.match, session.playerId, payload.pieceId);
    room.autoplayFor = null;
    this.commit(room, match, applyMove(match, move));
    return match.version;
  }

  restart(session: Session): number {
    const room = this.roomOf(session);
    this.requireHost(room, session);
    if (room.status !== "IN_PROGRESS" && room.status !== "FINISHED") {
      throw new CommandError("GAME_NOT_STARTED", "The game hasn't started yet.");
    }
    return this.beginMatch(room, "GAME_RESTARTED");
  }

  sync(session: Session, payload: Record<string, unknown>): number {
    if (typeof payload.knownVersion !== "number") {
      throw new CommandError("INVALID_PAYLOAD", "That request was not in the right format.");
    }
    const room = this.roomOf(session);
    if (session.socketId) {
      if (room.match) {
        this.outbox.toSocket(session.socketId, "game:state", stateMessage(room.match));
      } else {
        this.outbox.toSocket(session.socketId, "room:updated", toRoomSnapshot(room));
      }
    }
    return currentVersion(room);
  }

  // ---- debug routes only (mock-server/debug.ts) ----

  debugRoom(rawCode: unknown): Room {
    if (rawCode !== undefined && typeof rawCode !== "string") {
      throw new CommandError("INVALID_PAYLOAD", "roomCode must be text.");
    }
    return this.requireRoom(
      rawCode === undefined ? (this.newestRoomCode ?? "") : normaliseCode(rawCode),
    );
  }

  setForcedRoll(room: Room, value: number | null): void {
    room.forcedRoll = value;
    room.scriptedRolls = []; // an explicit force must beat whatever a scenario queued up
  }

  setNextRules(room: Room, rules: Partial<RuleConfig>): void {
    room.rules = { ...room.rules, ...rules };
    this.broadcastRoom(room);
  }

  /** Lets a scenario rearrange the running match. It returns the rolls that make its point. */
  jumpToScenario(room: Room, setUp: (match: Match) => number[]): number {
    const match = room.match;
    if (!match) throw new CommandError("GAME_NOT_STARTED", "Start a game before using this.");
    if (match.status !== "IN_PROGRESS") {
      throw new CommandError("GAME_NOT_IN_PROGRESS", "This game is not being played right now.");
    }
    room.scriptedRolls = setUp(match);
    room.autoplayFor = null;
    this.commit(room, match, []); // no event: nothing happened in the game, the board just changed
    return match.version;
  }

  // ---- internals ----

  private requireRoom(code: string): Room {
    const room = this.rooms.get(code);
    if (!room) throw new CommandError("ROOM_NOT_FOUND", "We couldn't find a room with that code.");
    return room;
  }

  private roomOf(session: Session): Room {
    const room = this.rooms.get(session.roomCode);
    if (!room) throw new CommandError("UNAUTHORIZED", "Your game session ended.");
    return room;
  }

  private playerOf(room: Room, session: Session): Player {
    const player = seatedPlayers(room).find(({ id }) => id === session.playerId);
    if (!player) throw new CommandError("UNAUTHORIZED", "Your game session ended.");
    return player;
  }

  private requireHost(room: Room, session: Session): void {
    if (room.hostId !== session.playerId) {
      throw new CommandError("NOT_HOST", "Only the host can do that.");
    }
  }

  private requireLobbyHost(session: Session): Room {
    const room = this.roomOf(session);
    this.requireHost(room, session);
    if (room.status !== "LOBBY") {
      throw new CommandError("GAME_ALREADY_STARTED", "The game has already started.");
    }
    return room;
  }

  private newRoom(request: Required<CreateRoomRequest>): Room {
    const code = this.freshCode();
    const room: Room = {
      code,
      status: "LOBBY",
      mode: request.mode,
      rules: { ...structuredClone(DEFAULT_RULES), ...request.rules },
      hostId: "",
      // Colours follow seats (docs/00-requirements.md §5), so 2 players are Red and Green.
      seats: COLOUR_ORDER.slice(0, request.seats).map((colour, index) => ({
        seat: index + 1,
        colour,
        player: null,
      })),
      aiDifficulty: request.aiDifficulty,
      aiLevels: new Map(),
      match: null,
      forcedRoll: null,
      scriptedRolls: [],
      autoplayFor: null,
      turnTimer: null,
      closeTimer: null,
      dropTimers: new Map(),
    };
    this.rooms.set(code, room);
    this.newestRoomCode = code;
    return room;
  }

  private freshCode(): string {
    for (;;) {
      const code = Array.from(
        { length: CODE_LENGTH },
        () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)],
      ).join("");
      if (!this.rooms.has(code)) return code;
    }
  }

  private newSession(room: Room, player: Player): Session {
    const session: Session = {
      token: randomBytes(24).toString("base64url"),
      playerId: player.id,
      roomCode: room.code,
      socketId: null,
    };
    this.sessions.set(session.token, session);
    return session;
  }

  private seatPlayer(slot: RoomSnapshot["seats"][number], name: string, isAi: boolean): Player {
    const player: Player = {
      id: randomUUID(),
      name,
      colour: slot.colour,
      isAi,
      connected: isAi, // a human only counts as connected once their socket arrives
      isHost: false,
      piecesHome: 0,
    };
    slot.player = player;
    return player;
  }

  private seatComputer(
    room: Room,
    slot: RoomSnapshot["seats"][number],
    difficulty: Difficulty,
  ): void {
    const computer = this.seatPlayer(slot, `Computer ${slot.seat}`, true);
    room.aiLevels.set(computer.id, difficulty);
  }

  private fillWithComputers(room: Room, difficulty: Difficulty): void {
    for (const slot of room.seats) {
      if (!slot.player) this.seatComputer(room, slot, difficulty);
    }
  }

  private beginMatch(room: Room, event: "GAME_STARTED" | "GAME_RESTARTED"): number {
    const players = seatedPlayers(room);
    if (players.length < MIN_PLAYERS) {
      throw new CommandError("NOT_ENOUGH_PLAYERS", "You need at least 2 players to start.");
    }
    const match = createMatch({
      roomCode: room.code,
      rules: structuredClone(room.rules),
      players,
    });
    room.match = match;
    room.scriptedRolls = [];
    room.autoplayFor = null;
    this.commit(room, match, [event]);
    return match.version;
  }

  private nextRoll(room: Room, match: Match): number {
    return room.scriptedRolls.shift() ?? room.forcedRoll ?? drawDie(match);
  }

  private broadcastRoom(room: Room): void {
    this.outbox.toRoom(room.code, "room:updated", toRoomSnapshot(room));
  }

  /** One accepted change: one new version, its events first, then the state (contract §4). */
  private commit(room: Room, match: Match, events: EventType[]): void {
    match.version += 1;
    if (room.status !== match.status) {
      room.status = match.status;
      this.broadcastRoom(room);
    }
    for (const type of events) {
      this.outbox.toRoom(room.code, "game:event", {
        v: CONTRACT_VERSION,
        version: match.version,
        type,
        data: {}, // the contract names no fields for any event yet (docs/01-contract.md §8)
      });
    }
    this.outbox.toRoom(room.code, "game:state", stateMessage(match));
    this.schedule(room, match);
  }

  private after(ms: number, action: () => void): NodeJS.Timeout {
    const timer = setTimeout(() => {
      try {
        action();
      } catch (error) {
        console.error("[mock] timed action failed", error);
      }
    }, ms);
    timer.unref(); // a pending turn must not keep a stopped server or a test run alive
    return timer;
  }

  private clearTurnTimer(room: Room): void {
    if (room.turnTimer) clearTimeout(room.turnTimer);
    room.turnTimer = null;
  }

  private clearDropTimer(room: Room, playerId: string): void {
    const timer = room.dropTimers.get(playerId);
    if (timer) clearTimeout(timer);
    room.dropTimers.delete(playerId);
  }

  /** Works out what happens next if nobody sends a command. Called after every change. */
  private schedule(room: Room, match: Match): void {
    this.clearTurnTimer(room);
    if (match.status !== "IN_PROGRESS") return;

    const { turn, rules } = match;
    const player = activePlayer(match);
    if (room.autoplayFor !== player.id) room.autoplayFor = null;

    if (turn.phase === "AWAITING_MOVE" && turn.legalMoves.length === 0) {
      room.turnTimer = this.after(this.timing.passDelayMs, () => {
        this.commit(room, match, passTurn(match));
      });
    } else if (player.isAi || room.autoplayFor === player.id) {
      room.turnTimer = this.after(rules.aiDelayMs, () => this.actFor(room, match, []));
    } else if (!player.connected) {
      room.turnTimer = this.after(rules.standInDelayMs, () => this.actFor(room, match, [])); // G-13
    } else if (
      rules.autoMoveSingleOption &&
      turn.phase === "AWAITING_MOVE" &&
      turn.legalMoves.length === 1
    ) {
      room.turnTimer = this.after(rules.aiDelayMs, () => this.actFor(room, match, []));
    } else if (turn.deadline !== null) {
      const remaining = Math.max(0, Date.parse(turn.deadline) - Date.now());
      room.turnTimer = this.after(remaining, () => {
        room.autoplayFor = player.id; // G-12: the computer plays out the rest of this turn
        this.actFor(room, match, ["PLAYER_IDLE"]);
      });
    }
  }

  private actFor(room: Room, match: Match, leadingEvents: EventType[]): void {
    const events =
      match.turn.phase === "AWAITING_ROLL"
        ? applyRoll(match, this.nextRoll(room, match))
        : applyMove(match, this.computerChoice(room, match));
    this.commit(room, match, [...leadingEvents, ...events]);
  }

  private computerChoice(room: Room, match: Match): ReturnType<typeof chooseMove> {
    // A stand-in for a human has no level of its own, so it plays at NORMAL.
    return chooseMove(match, room.aiLevels.get(match.turn.activePlayerId) ?? "NORMAL");
  }

  private removeHuman(room: Room, session: Session): void {
    this.sessions.delete(session.token);
    this.clearDropTimer(room, session.playerId);

    const slot = room.seats.find(({ player }) => player?.id === session.playerId);
    const player = slot?.player;
    if (!slot || !player) return;

    const wasHost = player.isHost;
    const inPlay = room.match?.status === "IN_PROGRESS";
    player.isHost = false;
    if (inPlay) {
      // Contract §4: the seat is played by the computer for the rest of the match.
      player.isAi = true;
      player.connected = true;
    } else {
      slot.player = null;
    }

    const humans = humansIn(room);
    const nextHost = humans.find(({ connected }) => connected) ?? humans[0];
    if (!nextHost) {
      this.closeRoom(room);
      return;
    }
    if (wasHost) {
      nextHost.isHost = true;
      room.hostId = nextHost.id;
    }
    if (inPlay && room.match) this.commit(room, room.match, ["PLAYER_LEFT"]);
    this.broadcastRoom(room);
    this.armCloseIfDeserted(room);
  }

  /** Contract §7: a room with no human connected closes after the absence limit. */
  private armCloseIfDeserted(room: Room): void {
    if (humansIn(room).some(({ connected }) => connected)) {
      if (room.closeTimer) clearTimeout(room.closeTimer);
      room.closeTimer = null;
    } else if (!room.closeTimer) {
      room.closeTimer = this.after(this.timing.absenceMs, () => this.closeRoom(room));
    }
  }

  private closeRoom(room: Room): void {
    this.clearTurnTimer(room);
    if (room.closeTimer) clearTimeout(room.closeTimer);
    for (const timer of room.dropTimers.values()) clearTimeout(timer);

    room.status = "CLOSED";
    if (room.match?.status === "IN_PROGRESS") {
      room.match.status = "CLOSED";
      this.commit(room, room.match, ["GAME_ABANDONED"]);
    }
    this.broadcastRoom(room);
    this.outbox.evictRoom(room.code);

    for (const [token, session] of this.sessions) {
      if (session.roomCode === room.code) this.sessions.delete(token);
    }
    this.rooms.delete(room.code);
    if (this.newestRoomCode === room.code) this.newestRoomCode = null;
  }
}
