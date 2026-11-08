// @vitest-environment node

// Everything here depends on the clock, so it runs on fake timers with a recording outbox.

import type { ServerEvent } from "../src/contract/events";
import type { GameStateSnapshot, RoomSnapshot } from "../src/contract/types";
import { placePiece } from "./game";
import { RoomRegistry, type Outbox, type Session } from "./rooms";

const TWO_MINUTES = 2 * 60 * 1000;

interface Sent {
  event: string;
  payload: unknown;
}

function setUp() {
  const sent: Sent[] = [];
  const outbox: Outbox = {
    toRoom: (_roomCode, event, payload) => sent.push({ event, payload }),
    toSocket: (_socketId, event, payload) => sent.push({ event, payload }),
    dropSocket: () => undefined,
    evictRoom: () => undefined,
  };
  const registry = new RoomRegistry(outbox, { passDelayMs: 1000, absenceMs: TWO_MINUTES });

  const sessionOf = (token: string): Session => {
    const session = registry.sessionForToken(token);
    if (!session) throw new Error("No session for that token");
    return session;
  };
  const latestState = (): GameStateSnapshot => {
    const message = sent.filter(({ event }) => event === "game:state").at(-1);
    if (!message) throw new Error("No game:state was sent");
    return (message.payload as { snapshot: GameStateSnapshot }).snapshot;
  };
  const eventTypes = (): string[] =>
    sent
      .filter(({ event }) => event === "game:event")
      .map(({ payload }) => {
        return (payload as ServerEvent).type;
      });
  const latestRoom = (): RoomSnapshot => {
    const message = sent.filter(({ event }) => event === "room:updated").at(-1);
    if (!message) throw new Error("No room:updated was sent");
    return message.payload as RoomSnapshot;
  };

  return { registry, sent, sessionOf, latestState, eventTypes, latestRoom };
}

function startSoloGame(context: ReturnType<typeof setUp>, rules: Record<string, unknown> = {}) {
  const created = context.registry.createRoom({
    displayName: "Host",
    mode: "HUMAN_VS_AI",
    seats: 4,
    rules: { aiDelayMs: 700, ...rules },
  });
  const session = context.sessionOf(created.sessionToken);
  context.registry.connect(session, "socket-1");
  context.registry.start(session, { fillEmptySeatsWithAi: false });
  return { created, session };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("the turn timer (G-12)", () => {
  it("does nothing before the deadline", () => {
    const context = setUp();
    startSoloGame(context);
    vi.advanceTimersByTime(29_000);
    expect(context.eventTypes()).not.toContain("PLAYER_IDLE");
  });

  it("nudges the player and lets the computer take over at the deadline", () => {
    const context = setUp();
    startSoloGame(context);
    vi.advanceTimersByTime(30_000);
    expect(context.eventTypes()).toEqual(expect.arrayContaining(["PLAYER_IDLE", "ROLLED"]));
    expect(context.latestState().turn.lastRoll).not.toBeNull();
  });

  it("has the computer play out the rest of that turn", () => {
    const context = setUp();
    const { created } = startSoloGame(context);
    context.registry.setForcedRoll(context.registry.debugRoom(created.roomCode), 6);

    vi.advanceTimersByTime(30_000); // the deadline: the computer rolls for them
    expect(context.eventTypes()).not.toContain("MOVED");
    vi.advanceTimersByTime(700); // one aiDelayMs later, it moves as well
    expect(context.eventTypes()).toContain("MOVED");
  });

  it("sets no timer when it is switched off", () => {
    const context = setUp();
    startSoloGame(context, { turnTimerSeconds: 0 });
    expect(context.latestState().turn.deadline).toBeNull();
    vi.advanceTimersByTime(10 * 60 * 1000);
    expect(context.eventTypes()).toEqual(["GAME_STARTED"]);
  });
});

describe("autoMoveSingleOption", () => {
  function rollWithOneLegalMove(context: ReturnType<typeof setUp>, autoMove: boolean): void {
    const { created, session } = startSoloGame(context, {
      autoMoveSingleOption: autoMove,
      turnTimerSeconds: 0,
    });
    context.registry.jumpToScenario(context.registry.debugRoom(created.roomCode), (match) => {
      const onTrack = match.pieces.find(({ id }) => id === "R1");
      if (onTrack) placePiece(onTrack, 10);
      return [3]; // the other three are in the yard, so R1 is the only piece that can move
    });
    context.registry.roll(session);
    vi.advanceTimersByTime(700);
  }

  it("moves the only piece for the player when it is on", () => {
    const context = setUp();
    rollWithOneLegalMove(context, true);
    expect(context.eventTypes()).toContain("MOVED");
  });

  it("waits for the player when it is off", () => {
    const context = setUp();
    rollWithOneLegalMove(context, false);
    expect(context.eventTypes()).not.toContain("MOVED");
  });
});

describe("a player who disconnects (G-13)", () => {
  it("has a stand-in play for them after standInDelayMs", () => {
    const context = setUp();
    const { session } = startSoloGame(context);

    context.registry.disconnect(session, "socket-1");
    expect(context.eventTypes()).toContain("PLAYER_DISCONNECTED");
    const versionAfterDisconnect = context.latestState().version;

    vi.advanceTimersByTime(2_999);
    expect(context.latestState().version).toBe(versionAfterDisconnect);
    vi.advanceTimersByTime(1);
    expect(context.eventTypes()).toContain("ROLLED");
  });

  it("gets control back when they return", () => {
    const context = setUp();
    const { session } = startSoloGame(context);

    context.registry.disconnect(session, "socket-1");
    context.registry.connect(session, "socket-2");
    expect(context.eventTypes()).toContain("PLAYER_RECONNECTED");

    vi.advanceTimersByTime(5_000); // past the stand-in delay
    expect(context.eventTypes()).not.toContain("ROLLED");
    expect(context.latestState().players[0]?.connected).toBe(true);
  });

  it("is not marked away when a newer tab replaced them", () => {
    const context = setUp();
    const { session } = startSoloGame(context);

    context.registry.connect(session, "socket-2"); // the new tab arrives first
    context.registry.disconnect(session, "socket-1");
    expect(context.eventTypes()).not.toContain("PLAYER_DISCONNECTED");
    expect(context.sent.map(({ event }) => event)).toContain("session:replaced");
  });
});

describe("a turn with no legal move", () => {
  it("passes after one second", () => {
    const context = setUp();
    const { created, session } = startSoloGame(context);
    const room = context.registry.debugRoom(created.roomCode);
    context.registry.setForcedRoll(room, 3);

    context.registry.roll(session);
    vi.advanceTimersByTime(999);
    expect(context.eventTypes()).not.toContain("TURN_PASSED");
    vi.advanceTimersByTime(1);
    expect(context.eventTypes()).toContain("TURN_PASSED");
  });
});

describe("absence (contract §7)", () => {
  function lobbyWithGuest(context: ReturnType<typeof setUp>) {
    const created = context.registry.createRoom({
      displayName: "Host",
      mode: "HUMAN_VS_HUMAN",
      seats: 4,
    });
    const joined = context.registry.joinRoom(created.roomCode, { displayName: "Guest" });
    const host = context.sessionOf(created.sessionToken);
    const guest = context.sessionOf(joined.sessionToken);
    context.registry.connect(host, "socket-1");
    context.registry.connect(guest, "socket-2");
    return { created, host, guest };
  }

  it("drops a lobby seat after two minutes away", () => {
    const context = setUp();
    const { guest } = lobbyWithGuest(context);

    context.registry.disconnect(guest, "socket-2");
    vi.advanceTimersByTime(TWO_MINUTES - 1);
    expect(context.latestRoom().seats[1]?.player).not.toBeNull();
    vi.advanceTimersByTime(1);
    expect(context.latestRoom().seats[1]?.player).toBeNull();
    expect(context.registry.sessionForToken(guest.token)).toBeUndefined();
  });

  it("keeps the seat if they come back in time", () => {
    const context = setUp();
    const { guest } = lobbyWithGuest(context);

    context.registry.disconnect(guest, "socket-2");
    vi.advanceTimersByTime(TWO_MINUTES - 1);
    context.registry.connect(guest, "socket-3");
    vi.advanceTimersByTime(TWO_MINUTES);
    expect(context.latestRoom().seats[1]?.player?.connected).toBe(true);
  });

  it("closes a room once no human has been connected for two minutes", () => {
    const context = setUp();
    const { session } = startSoloGame(context, { turnTimerSeconds: 0 });

    context.registry.disconnect(session, "socket-1");
    vi.advanceTimersByTime(TWO_MINUTES);
    expect(context.registry.roomCount()).toBe(0);
    expect(context.registry.sessionForToken(session.token)).toBeUndefined();
  });

  it("gives the host role to the next human when the host leaves", () => {
    const context = setUp();
    const { host, guest } = lobbyWithGuest(context);

    context.registry.leave(host);
    const room = context.latestRoom();
    expect(room.hostId).toBe(guest.playerId);
    expect(room.seats[1]?.player?.isHost).toBe(true);
    expect(room.seats[0]?.player).toBeNull();
  });

  it("makes a seat computer-played when someone leaves mid-game", () => {
    const context = setUp();
    const { created, host, guest } = lobbyWithGuest(context);
    context.registry.start(host, { fillEmptySeatsWithAi: true });

    context.registry.leave(guest);
    expect(context.eventTypes()).toContain("PLAYER_LEFT");
    expect(context.latestState().players[1]).toMatchObject({ isAi: true, isHost: false });
    expect(context.registry.previewRoom(created.roomCode).status).toBe("IN_PROGRESS");
  });

  it("closes the room at once when the last human leaves", () => {
    const context = setUp();
    const { session } = startSoloGame(context);

    context.registry.leave(session);
    expect(context.eventTypes()).toContain("GAME_ABANDONED");
    expect(context.registry.roomCount()).toBe(0);
  });
});

describe("a new match", () => {
  it("restarts its version at 1 with a new match id", () => {
    const context = setUp();
    const { session } = startSoloGame(context);
    const first = context.latestState();
    context.registry.roll(session);
    expect(context.latestState().version).toBe(2);

    context.registry.restart(session);
    const second = context.latestState();
    expect(second.version).toBe(1);
    expect(second.matchId).not.toBe(first.matchId);
    expect(context.eventTypes().at(-1)).toBe("GAME_RESTARTED");
  });

  it("keeps a rule change for the next match only", () => {
    const context = setUp();
    const { created, session } = startSoloGame(context);
    const room = context.registry.debugRoom(created.roomCode);

    context.registry.setNextRules(room, { safeSquares: [1, 2] });
    expect(context.latestState().rules.safeSquares).toEqual([0, 8, 13, 21, 26, 34, 39, 47]);

    context.registry.restart(session);
    expect(context.latestState().rules.safeSquares).toEqual([1, 2]);
  });
});
