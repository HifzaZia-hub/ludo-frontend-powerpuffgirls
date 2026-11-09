import { FakeAdapter } from "@/adapter/FakeAdapter";
import { defaultRules } from "@/config/defaultRules";
import { cellKey, pieceCell } from "@/config/geometry";
import type {
  CreateRoomRequest,
  CreateRoomResponse,
  GameStateSnapshot,
  JoinRoomResponse,
  ServerError,
  TurnState,
} from "@/contract/types";
import {
  createGameStore,
  secondsUntil,
  selectActivePlayer,
  selectCanMove,
  selectCanRoll,
  selectHostName,
  selectIsComputerTurn,
  selectIsHost,
  selectIsMyTurn,
  selectLegalMoveFor,
  selectLegalPieceIds,
  selectMoveOffered,
  selectMoveOptions,
  selectMe,
  selectPiecesByCell,
  selectPlayerProgress,
  selectProgress,
  selectSecondsLeft,
  selectTurnKind,
  type GameStore,
} from "@/store/gameStore";
import type { ServerEvent } from "@/contract/events";
import { makePlayer, makeRoom } from "@/testRoom";

function makeSnapshot(
  version: number,
  overrides: Partial<GameStateSnapshot> = {},
): GameStateSnapshot {
  return {
    v: "1.0.0",
    roomCode: "K7QX2M",
    matchId: "match-1",
    version,
    status: "IN_PROGRESS",
    rules: defaultRules,
    players: [
      {
        id: "p1",
        name: "Hifza",
        colour: "RED",
        isAi: false,
        connected: true,
        isHost: true,
        piecesHome: 0,
      },
      {
        id: "p2",
        name: "Computer",
        colour: "YELLOW",
        isAi: true,
        connected: true,
        isHost: false,
        piecesHome: 1,
      },
    ],
    pieces: [
      { id: "R1", colour: "RED", step: 0, boardSquare: null },
      { id: "R2", colour: "RED", step: 3, boardSquare: 2 },
      { id: "Y1", colour: "YELLOW", step: 57, boardSquare: null },
    ],
    turn: {
      activePlayerId: "p1",
      phase: "AWAITING_MOVE",
      lastRoll: 6,
      sixesInRow: 1,
      legalMoves: [{ pieceId: "R1", fromStep: 0, toStep: 1, captures: [] }],
      deadline: null,
    },
    seedHash: "hash",
    ...overrides,
  };
}

function rejection(
  code: ServerError["code"],
  message = "Server says no.",
): {
  ok: false;
  error: ServerError;
} {
  return { ok: false, error: { code, message } };
}

function makeStore(): { adapter: FakeAdapter; store: GameStore } {
  const adapter = new FakeAdapter();
  const store = createGameStore(adapter);
  store.getState().listen();
  return { adapter, store };
}

describe("applying snapshots", () => {
  // NFR-SYS-04
  it("keeps v5 when v4 arrives after it", () => {
    const { adapter, store } = makeStore();

    adapter.pushState(makeSnapshot(5));
    adapter.pushState(makeSnapshot(4));

    expect(store.getState().snapshot?.version).toBe(5);
    expect(adapter.commands).toEqual([]);
  });

  it("applies v7 after v5 and asks the server to sync from 5", () => {
    const { adapter, store } = makeStore();

    adapter.pushState(makeSnapshot(5));
    adapter.pushState(makeSnapshot(7));

    expect(store.getState().snapshot?.version).toBe(7);
    expect(adapter.commands).toEqual([{ name: "sync", knownVersion: 5 }]);
  });

  it("applies the next version without asking for a sync", () => {
    const { adapter, store } = makeStore();

    adapter.pushState(makeSnapshot(5));
    adapter.pushState(makeSnapshot(6));

    expect(store.getState().snapshot?.version).toBe(6);
    expect(adapter.commands).toEqual([]);
  });

  // Contract §8: a restart goes back to version 1 with a new matchId.
  it("treats a new matchId as a fresh match, even at a lower version", () => {
    const { adapter, store } = makeStore();

    adapter.pushState(makeSnapshot(50));
    adapter.pushState(makeSnapshot(1, { matchId: "match-2" }));

    expect(store.getState().snapshot?.matchId).toBe("match-2");
    expect(store.getState().snapshot?.version).toBe(1);
    expect(adapter.commands).toEqual([]);
  });
});

describe("applying events", () => {
  it("never changes the snapshot", () => {
    const { adapter, store } = makeStore();
    adapter.pushState(makeSnapshot(5));
    const before = store.getState().snapshot;

    adapter.pushEvent({ v: "1.0.0", version: 6, type: "CAPTURED", data: {} });

    expect(store.getState().snapshot).toBe(before);
    expect(store.getState().lastEvent?.type).toBe("CAPTURED");
  });

  it("keeps only the last 50 events", () => {
    const { adapter, store } = makeStore();

    for (let version = 1; version <= 60; version++) {
      adapter.pushEvent({ v: "1.0.0", version, type: "ROLLED", data: {} });
    }

    const { eventLog } = store.getState();
    expect(eventLog).toHaveLength(50);
    expect(eventLog[0]?.version).toBe(11);
    expect(eventLog[49]?.version).toBe(60);
  });
});

describe("sending commands", () => {
  // FR-SYS-04 POST-04-1, NFR-SYS-04
  it("leaves the snapshot deep-equal after a rejected move", async () => {
    const { adapter, store } = makeStore();
    adapter.pushState(makeSnapshot(5));
    const before = structuredClone(store.getState().snapshot);
    adapter.queueAck(rejection("ILLEGAL_MOVE", "A piece needs a 6 to leave the yard."));

    await store.getState().move("R1");

    expect(store.getState().snapshot).toEqual(before);
    expect(store.getState().pendingCommand).toBeNull();
    // Contract §6: ILLEGAL_MOVE shows the server's own reason.
    expect(store.getState().toasts[0]?.message).toBe("A piece needs a 6 to leave the yard.");
  });

  it("ignores a late answer to a command that has been replaced", async () => {
    const { adapter, store } = makeStore();
    const releaseOld = adapter.holdNextAck();
    const releaseNew = adapter.holdNextAck();

    const oldRoll = store.getState().roll();
    store.getState().reset();
    const newRoll = store.getState().roll();
    const newPending = store.getState().pendingCommand;

    releaseOld(rejection("NOT_YOUR_TURN"));
    await oldRoll;

    expect(store.getState().pendingCommand).toEqual(newPending);
    expect(store.getState().toasts).toEqual([]);
    expect(adapter.commands).toEqual([{ name: "roll" }, { name: "roll" }]);

    releaseNew({ ok: true, version: 6 });
    await newRoll;
    expect(store.getState().pendingCommand).toBeNull();
  });

  // FR-SYS-04 EXC-04-1: LgsAdapter turns a missing ack into exactly this answer.
  it("keeps state, clears pending and tells the player after a timed-out command", async () => {
    const { adapter, store } = makeStore();
    adapter.pushState(makeSnapshot(5));
    const before = structuredClone(store.getState().snapshot);
    adapter.queueAck(rejection("INTERNAL_ERROR", "The server did not answer."));

    await store.getState().roll();

    expect(store.getState().snapshot).toEqual(before);
    expect(store.getState().pendingCommand).toBeNull();
    expect(store.getState().toasts[0]?.message).toBe(
      "Something went wrong. Your game is safe — try again.",
    );
  });

  it("asks for a sync after NOT_YOUR_TURN", async () => {
    const { adapter, store } = makeStore();
    adapter.pushState(makeSnapshot(5));
    adapter.queueAck(rejection("NOT_YOUR_TURN"));

    await store.getState().roll();

    expect(adapter.commands).toEqual([{ name: "roll" }, { name: "sync", knownVersion: 5 }]);
  });

  it("does not ask for a sync after INVALID_NAME", async () => {
    const { adapter, store } = makeStore();
    adapter.pushState(makeSnapshot(5));
    adapter.queueAck(rejection("INVALID_NAME"));

    await store.getState().roll();

    expect(adapter.commands).toEqual([{ name: "roll" }]);
  });

  // FR-SYS-02 EXC-02-1
  it("sends nothing for a second roll while one is pending", async () => {
    const { adapter, store } = makeStore();
    const release = adapter.holdNextAck();

    const first = store.getState().roll();
    expect(store.getState().pendingCommand?.kind).toBe("roll");
    await store.getState().roll();

    expect(adapter.commands).toEqual([{ name: "roll" }]);

    release({ ok: true, version: 6 });
    await first;
    expect(store.getState().pendingCommand).toBeNull();
  });

  // FR-SYS-03 EXC-03-2
  it("does not move anything when a move is accepted, until the snapshot arrives", async () => {
    const { adapter, store } = makeStore();
    adapter.pushState(makeSnapshot(5));
    const before = store.getState().snapshot;
    adapter.queueAck({ ok: true, version: 6 });

    await store.getState().move("R1");

    expect(store.getState().snapshot).toBe(before);
  });
});

describe("connection changes", () => {
  it("syncs when the connection comes back after reconnecting", () => {
    const { adapter, store } = makeStore();
    adapter.pushState(makeSnapshot(5));

    adapter.pushConnection("reconnecting");
    adapter.pushConnection("live");

    expect(store.getState().connection).toBe("live");
    expect(adapter.commands).toEqual([{ name: "sync", knownVersion: 5 }]);
  });

  it("does not sync on the first connection", () => {
    const { adapter } = makeStore();

    adapter.pushConnection("connecting");
    adapter.pushConnection("live");

    expect(adapter.commands).toEqual([]);
  });

  it("marks the connection lost and tells the player when another tab takes over", () => {
    const { adapter, store } = makeStore();

    adapter.pushConnection("live");
    adapter.pushSessionReplaced();

    expect(store.getState().connection).toBe("lost");
    expect(store.getState().toasts[0]?.message).toBe("This game is open in another tab.");
  });

  it("stops listening when the unsubscribe function is called", () => {
    const adapter = new FakeAdapter();
    const store = createGameStore(adapter);
    const stop = store.getState().listen();

    stop();
    adapter.pushState(makeSnapshot(5));

    expect(store.getState().snapshot).toBeNull();
  });
});

describe("unsolicited server errors", () => {
  it("shows friendly copy and syncs on a stale-state code", () => {
    const { adapter, store } = makeStore();
    adapter.pushState(makeSnapshot(5));

    adapter.pushError({ code: "GAME_NOT_IN_PROGRESS", message: "No." });

    expect(store.getState().toasts).toHaveLength(1);
    expect(adapter.commands).toEqual([{ name: "sync", knownVersion: 5 }]);
  });
});

describe("rooms", () => {
  const room = makeRoom();
  const created: { ok: true; data: CreateRoomResponse } = {
    ok: true,
    data: { v: "1.0.0", roomCode: "K7QX2M", playerId: "p1", sessionToken: "secret", room },
  };
  const joined: { ok: true; data: JoinRoomResponse } = {
    ok: true,
    data: { v: "1.0.0", playerId: "p2", sessionToken: "secret-2", room },
  };
  const friendsGame: CreateRoomRequest = {
    displayName: "Rida",
    mode: "HUMAN_VS_HUMAN",
    seats: 4,
  };
  const computerGame: CreateRoomRequest = {
    displayName: "Rida",
    mode: "HUMAN_VS_AI",
    seats: 2,
    aiDifficulty: "EASY",
  };
  const busy = "The game server is busy. Try again in a minute.";

  function savedToken(): string | null {
    const saved = sessionStorage.getItem("ludo-session");
    return saved === null ? null : (JSON.parse(saved) as { sessionToken: string }).sessionToken;
  }

  beforeEach(() => {
    sessionStorage.clear();
  });

  describe("creating", () => {
    it("connects with the returned token and remembers the player and the room", async () => {
      const { adapter, store } = makeStore();
      adapter.createRoomResult = created;

      const result = await store.getState().createRoom(friendsGame);

      expect(result).toEqual({ ok: true });
      expect(adapter.createRequests).toEqual([friendsGame]);
      expect(adapter.connectedToken).toBe("secret");
      expect(store.getState().myPlayerId).toBe("p1");
      expect(store.getState().room).toBe(room);
    });

    // CLAUDE.md §4
    it("keeps the token in sessionStorage and out of the store", async () => {
      const { adapter, store } = makeStore();
      adapter.createRoomResult = created;

      await store.getState().createRoom(friendsGame);

      expect(savedToken()).toBe("secret");
      expect(JSON.stringify(store.getState())).not.toContain("secret");
    });

    it("waits for the host to start a game with friends", async () => {
      const { adapter, store } = makeStore();
      adapter.createRoomResult = created;

      await store.getState().createRoom(friendsGame);

      expect(adapter.commands).toEqual([]);
    });

    it("starts a game against the computer straight away", async () => {
      const { adapter, store } = makeStore();
      adapter.createRoomResult = created;

      await store.getState().createRoom(computerGame);

      expect(adapter.commands).toEqual([{ name: "start", fillEmptySeatsWithAi: false }]);
    });

    // The room exists by now, so a retry must not create a second one.
    it("still enters the room when that automatic start fails", async () => {
      const { adapter, store } = makeStore();
      adapter.createRoomResult = created;
      adapter.queueAck(rejection("INTERNAL_ERROR"));

      const result = await store.getState().createRoom(computerGame);

      expect(result).toEqual({ ok: true });
      expect(store.getState().room).toBe(room);
      expect(store.getState().toasts).toHaveLength(1);
    });

    // FR-SYS-01 EXC-01-1
    it("puts a name problem under the name field and stays out of the room", async () => {
      const { adapter, store } = makeStore();
      adapter.createRoomResult = rejection("INVALID_NAME");

      const result = await store.getState().createRoom(friendsGame);

      expect(result).toEqual({
        ok: false,
        field: "name",
        message: "Use 1–20 letters or numbers for your name.",
      });
      expect(adapter.connectedToken).toBeNull();
      expect(store.getState().room).toBeNull();
      expect(store.getState().toasts).toEqual([]);
      expect(savedToken()).toBeNull();
    });

    it("sends a problem that isn't about a field to a toast", async () => {
      const { adapter, store } = makeStore();
      adapter.createRoomResult = rejection("SERVER_BUSY");

      const result = await store.getState().createRoom(friendsGame);

      expect(result).toEqual({ ok: false, field: null, message: busy });
      expect(store.getState().toasts[0]?.message).toBe(busy);
      expect(store.getState().toasts[0]?.kind).toBe("error");
    });

    it("clears errors from earlier attempts once a room is created", async () => {
      const { adapter, store } = makeStore();
      adapter.createRoomResult = rejection("SERVER_BUSY");
      await store.getState().createRoom(friendsGame);

      adapter.createRoomResult = created;
      await store.getState().createRoom(friendsGame);

      expect(store.getState().toasts).toEqual([]);
    });
  });

  describe("joining", () => {
    it("connects with its own token and sends the name", async () => {
      const { adapter, store } = makeStore();
      adapter.joinRoomResult = joined;

      const result = await store.getState().joinRoom("K7QX2M", "Hamza");

      expect(result).toEqual({ ok: true });
      expect(adapter.joinRequests).toEqual([{ code: "K7QX2M", request: { displayName: "Hamza" } }]);
      expect(adapter.connectedToken).toBe("secret-2");
      expect(store.getState().myPlayerId).toBe("p2");
      expect(savedToken()).toBe("secret-2");
    });

    it.each([
      ["NAME_TAKEN", "name"],
      ["INVALID_NAME", "name"],
      ["INVALID_CODE", "roomCode"],
      ["ROOM_NOT_FOUND", "roomCode"],
      ["ROOM_FULL", "roomCode"],
      ["GAME_ALREADY_STARTED", "roomCode"],
    ] as const)("points %s at the %s field", async (code, field) => {
      const { adapter, store } = makeStore();
      adapter.joinRoomResult = rejection(code);

      const result = await store.getState().joinRoom("K7QX2M", "Hamza");

      expect(result).toMatchObject({ ok: false, field });
      expect(adapter.connectedToken).toBeNull();
    });

    // A toast would sit behind the join modal, where it can't be dismissed.
    it.each(["SERVER_BUSY", "RATE_LIMITED"] as const)(
      "hands %s back to the form without a toast",
      async (code) => {
        const { adapter, store } = makeStore();
        adapter.joinRoomResult = rejection(code);

        const result = await store.getState().joinRoom("K7QX2M", "Hamza");

        expect(result).toMatchObject({ ok: false, field: null });
        expect(store.getState().toasts).toEqual([]);
      },
    );
  });

  describe("previewing", () => {
    it("says only that the code found a game", async () => {
      const { adapter, store } = makeStore();
      adapter.previewRoomResult = { ok: true, data: { whatever: "the backend sends" } };

      expect(await store.getState().previewRoom("K7QX2M")).toEqual({ ok: true });
      expect(adapter.previewCodes).toEqual(["K7QX2M"]);
    });

    it("points an unknown code at the code field", async () => {
      const { adapter, store } = makeStore();
      adapter.previewRoomResult = rejection("ROOM_NOT_FOUND");

      expect(await store.getState().previewRoom("K7QX2M")).toEqual({
        ok: false,
        field: "roomCode",
        message: "We couldn't find that game. Check the code.",
      });
    });
  });

  describe("lobby commands", () => {
    function storeInLobby(myPlayerId = "p1"): { adapter: FakeAdapter; store: GameStore } {
      const made = makeStore();
      made.store.setState({ room, myPlayerId });
      return made;
    }

    it("sends the seat and difficulty, and shows it as pending until the answer", async () => {
      const { adapter, store } = storeInLobby();
      const release = adapter.holdNextAck();

      const adding = store.getState().addAi(2, "NORMAL");
      expect(store.getState().pendingCommand).toMatchObject({ kind: "addAi", seat: 2 });
      expect(adapter.commands).toEqual([{ name: "addAi", seat: 2, difficulty: "NORMAL" }]);

      release({ ok: true, version: 0 });
      await adding;
      expect(store.getState().pendingCommand).toBeNull();
    });

    // The seat list only ever changes when the server says so.
    it("leaves the seats alone until room:updated arrives", async () => {
      const { adapter, store } = storeInLobby();

      await store.getState().addAi(2, "NORMAL");
      expect(store.getState().room).toBe(room);

      const computer = makePlayer("p2", "Computer 1", { isAi: true, colour: "GREEN" });
      const updated = makeRoom({
        seats: room.seats.map((seat) => (seat.seat === 2 ? { ...seat, player: computer } : seat)),
      });
      adapter.pushRoom(updated);
      expect(store.getState().room).toBe(updated);
    });

    it("sends the fill choice when starting", async () => {
      const { adapter, store } = storeInLobby();

      await store.getState().startGame({ fillEmptySeatsWithAi: true });

      expect(adapter.commands).toEqual([{ name: "start", fillEmptySeatsWithAi: true }]);
    });

    it("keeps the lobby open and explains when there aren't enough players", async () => {
      const { adapter, store } = storeInLobby();
      adapter.queueAck(rejection("NOT_ENOUGH_PLAYERS"));

      await store.getState().startGame({ fillEmptySeatsWithAi: false });

      expect(store.getState().room).toBe(room);
      expect(store.getState().toasts[0]?.message).toBe(
        "You need at least 2 players. Add a computer player?",
      );
    });

    it("lets go of the room once a leave is accepted", async () => {
      const { adapter, store } = storeInLobby();
      adapter.connect("secret");
      sessionStorage.setItem("ludo-session", '{"sessionToken":"secret"}');

      expect(await store.getState().leaveRoom()).toBe(true);

      expect(adapter.commands).toEqual([{ name: "leave" }]);
      expect(adapter.connectedToken).toBeNull();
      expect(savedToken()).toBeNull();
      expect(store.getState().room).toBeNull();
      expect(store.getState().myPlayerId).toBeNull();
      expect(store.getState().connection).toBeNull();
    });

    // FR-SYS-08 POST-08-3
    it("keeps everything when a leave fails", async () => {
      const { adapter, store } = storeInLobby();
      adapter.connect("secret");
      sessionStorage.setItem("ludo-session", '{"sessionToken":"secret"}');
      adapter.queueAck(rejection("INTERNAL_ERROR"));

      expect(await store.getState().leaveRoom()).toBe(false);

      expect(adapter.connectedToken).toBe("secret");
      expect(savedToken()).toBe("secret");
      expect(store.getState().room).toBe(room);
      expect(store.getState().toasts).toHaveLength(1);
    });
  });

  // Contract §6: UNAUTHORIZED clears the session and goes back to the main screen.
  it("drops the room and the saved session when the server ends the session", () => {
    const { adapter, store } = makeStore();
    store.setState({ room, myPlayerId: "p1" });
    adapter.connect("secret");
    sessionStorage.setItem("ludo-session", '{"sessionToken":"secret"}');

    adapter.pushError({ code: "UNAUTHORIZED", message: "Your game session ended." });

    expect(store.getState().room).toBeNull();
    expect(adapter.connectedToken).toBeNull();
    expect(savedToken()).toBeNull();
    expect(store.getState().toasts[0]?.message).toBe(
      "Your game session ended. Please start again.",
    );
  });
});

describe("toasts", () => {
  it("doesn't stack the same message when a request keeps failing", () => {
    const { adapter, store } = makeStore();

    adapter.pushError({ code: "SERVER_BUSY", message: "Busy." });
    adapter.pushError({ code: "SERVER_BUSY", message: "Busy." });

    expect(store.getState().toasts).toHaveLength(1);
  });

  it("removes only the one that was dismissed", () => {
    const { adapter, store } = makeStore();
    adapter.pushError({ code: "SERVER_BUSY", message: "Busy." });
    adapter.pushError({ code: "RATE_LIMITED", message: "Slow." });
    const [first, second] = store.getState().toasts;
    if (!first || !second) throw new Error("two different errors make two toasts");

    store.getState().dismissToast(first.id);

    expect(store.getState().toasts).toEqual([second]);
  });
});

// D2 FR-29, FR-SYS-06 POST-06-3
describe("the session score", () => {
  function finished(matchId: string, version: number, winnerId?: string): GameStateSnapshot {
    return makeSnapshot(version, { matchId, status: "FINISHED", winnerId });
  }

  it("counts the winner the server named", () => {
    const { store } = makeStore();

    store.getState().applySnapshot(finished("m1", 5, "p1"));

    expect(store.getState().sessionWins).toEqual({ p1: 1 });
  });

  it("counts a match only once, even if its result arrives again", () => {
    const { store } = makeStore();

    store.getState().applySnapshot(finished("m1", 5, "p1"));
    store.getState().applySnapshot(finished("m1", 6, "p1"));

    expect(store.getState().sessionWins).toEqual({ p1: 1 });
  });

  it("adds up across rematches", () => {
    const { store } = makeStore();

    store.getState().applySnapshot(finished("m1", 5, "p1"));
    store.getState().applySnapshot(finished("m2", 4, "p1"));
    store.getState().applySnapshot(finished("m3", 3, "p2"));

    expect(store.getState().sessionWins).toEqual({ p1: 2, p2: 1 });
  });

  it("counts nothing when the server named no winner", () => {
    const { store } = makeStore();

    store.getState().applySnapshot(finished("m1", 5));

    expect(store.getState().sessionWins).toEqual({});
  });

  it("counts nothing while the match is running", () => {
    const { store } = makeStore();

    store.getState().applySnapshot(makeSnapshot(5, { winnerId: "p1" }));

    expect(store.getState().sessionWins).toEqual({});
  });

  it("still applies the snapshot that ends the match", () => {
    const { store } = makeStore();
    const last = finished("m1", 5, "p1");

    store.getState().applySnapshot(last);

    expect(store.getState().snapshot).toBe(last);
  });

  it("is forgotten when you leave the room", async () => {
    const { store } = makeStore();
    store.getState().applySnapshot(finished("m1", 5, "p1"));

    await store.getState().leaveRoom();

    expect(store.getState().sessionWins).toEqual({});
  });
});

// FR-SYS-08
describe("restarting", () => {
  it("asks the server and says it was accepted", async () => {
    const { adapter, store } = makeStore();

    await expect(store.getState().restart()).resolves.toBe(true);

    expect(adapter.commands).toEqual([{ name: "restart" }]);
  });

  // POST-08-3
  it("keeps the game and explains when the server refuses", async () => {
    const { adapter, store } = makeStore();
    store.getState().applySnapshot(makeSnapshot(5));
    const before = store.getState().snapshot;
    adapter.queueAck(rejection("SERVER_BUSY"));

    await expect(store.getState().restart()).resolves.toBe(false);

    expect(store.getState().snapshot).toBe(before);
    expect(store.getState().toasts).toHaveLength(1);
  });

  it("sends nothing while another command is waiting", async () => {
    const { adapter, store } = makeStore();
    store.setState({ pendingCommand: { id: 1, kind: "roll" } });

    await expect(store.getState().restart()).resolves.toBe(false);

    expect(adapter.commands).toEqual([]);
  });

  it("clears the old match's events, but not the board, on GAME_RESTARTED", () => {
    const { store } = makeStore();
    store.getState().applySnapshot(makeSnapshot(5));
    const before = store.getState().snapshot;
    store.getState().applyEvent({ v: "1.0.0", version: 5, type: "ROLLED", data: {} });
    const restarted: ServerEvent = { v: "1.0.0", version: 1, type: "GAME_RESTARTED", data: {} };

    store.getState().applyEvent(restarted);

    expect(store.getState().eventLog).toEqual([restarted]);
    expect(store.getState().snapshot).toBe(before);
  });

  it("keeps the session score through a restart", () => {
    const { store } = makeStore();
    store
      .getState()
      .applySnapshot(makeSnapshot(5, { matchId: "m1", status: "FINISHED", winnerId: "p1" }));

    store.getState().applyEvent({ v: "1.0.0", version: 1, type: "GAME_RESTARTED", data: {} });
    store.getState().applySnapshot(makeSnapshot(1, { matchId: "m2" }));

    expect(store.getState().sessionWins).toEqual({ p1: 1 });
  });
});

describe("forgetting a room the server has closed", () => {
  it("lets go without asking the server", () => {
    const { adapter, store } = makeStore();
    store.setState({ room: makeRoom(), myPlayerId: "p1" });
    adapter.connect("token");

    store.getState().forgetRoom();

    expect(store.getState().room).toBeNull();
    expect(store.getState().myPlayerId).toBeNull();
    expect(adapter.connectedToken).toBeNull();
    expect(adapter.commands).toEqual([]);
  });
});

describe("the result of a roll", () => {
  it("is the version the server gave it", async () => {
    const { adapter, store } = makeStore();
    adapter.queueAck({ ok: true, version: 9 });

    await expect(store.getState().roll()).resolves.toBe(9);
  });

  it("is null when the server refuses", async () => {
    const { adapter, store } = makeStore();
    adapter.queueAck(rejection("NOT_YOUR_TURN"));

    await expect(store.getState().roll()).resolves.toBeNull();
  });

  it("is null for a press that didn't count", async () => {
    const { adapter, store } = makeStore();
    const release = adapter.holdNextAck();
    const first = store.getState().roll();

    await expect(store.getState().roll()).resolves.toBeNull();

    release({ ok: true, version: 9 });
    await first;
  });
});

describe("selectors", () => {
  function storeWith(snapshot: GameStateSnapshot, myPlayerId = "p1"): GameStore {
    const { store } = makeStore();
    store.setState({ snapshot, myPlayerId });
    return store;
  }

  const rollTurn = makeSnapshot(5).turn;
  const awaitingRoll: TurnState = { ...rollTurn, phase: "AWAITING_ROLL", legalMoves: [] };

  it("knows whose turn it is", () => {
    const state = storeWith(makeSnapshot(5)).getState();
    expect(selectIsMyTurn(state)).toBe(true);
    expect(selectActivePlayer(state)?.name).toBe("Hifza");
    expect(selectMe(state)?.colour).toBe("RED");
    expect(selectIsComputerTurn(state)).toBe(false);
  });

  it("is not my turn once the match is over", () => {
    const state = storeWith(makeSnapshot(5, { status: "FINISHED" })).getState();
    expect(selectIsMyTurn(state)).toBe(false);
    expect(selectCanMove(state)).toBe(false);
  });

  // FR-SYS-02: all five conditions have to hold.
  describe("selectCanRoll", () => {
    function liveStore(overrides: Partial<GameStateSnapshot> = {}, myPlayerId = "p1"): GameStore {
      const store = storeWith(makeSnapshot(5, { turn: awaitingRoll, ...overrides }), myPlayerId);
      store.setState({ connection: "live" });
      return store;
    }

    it("allows a roll when all five hold", () => {
      const state = liveStore().getState();
      expect(selectCanRoll(state)).toBe(true);
      expect(selectCanMove(state)).toBe(false);
    });

    it("refuses once the match isn't running", () => {
      expect(selectCanRoll(liveStore({ status: "FINISHED" }).getState())).toBe(false);
    });

    it("refuses on someone else's turn", () => {
      expect(selectCanRoll(liveStore({}, "p2").getState())).toBe(false);
    });

    it("refuses in the move phase", () => {
      expect(selectCanRoll(liveStore({ turn: rollTurn }).getState())).toBe(false);
    });

    it("refuses while a command is pending", () => {
      const store = liveStore();
      store.setState({ pendingCommand: { id: 1, kind: "roll" } });
      expect(selectCanRoll(store.getState())).toBe(false);
    });

    it.each(["connecting", "reconnecting", "lost", null] as const)(
      "refuses while the connection is %s",
      (connection) => {
        const store = liveStore();
        store.setState({ connection });
        expect(selectCanRoll(store.getState())).toBe(false);
      },
    );
  });

  describe("selectTurnKind", () => {
    const humanOpponent = makeSnapshot(5).players.map((player) => ({ ...player, isAi: false }));
    const theirTurn: TurnState = { ...awaitingRoll, activePlayerId: "p2" };

    it("says when I should roll", () => {
      const state = storeWith(makeSnapshot(5, { turn: awaitingRoll })).getState();
      expect(selectTurnKind(state)).toBe("myRoll");
    });

    it("says when I should pick a piece", () => {
      expect(selectTurnKind(storeWith(makeSnapshot(5)).getState())).toBe("myMove");
    });

    // FR-SYS-07
    it("recognises a computer's turn", () => {
      const state = storeWith(makeSnapshot(5, { turn: theirTurn })).getState();
      expect(selectTurnKind(state)).toBe("computer");
    });

    it("recognises another person's turn", () => {
      const snapshot = makeSnapshot(5, { turn: theirTurn, players: humanOpponent });
      expect(selectTurnKind(storeWith(snapshot).getState())).toBe("human");
    });

    it("has nothing to say when no match is running", () => {
      expect(selectTurnKind(makeStore().store.getState())).toBeNull();
      const finished = makeSnapshot(5, { status: "FINISHED" });
      expect(selectTurnKind(storeWith(finished).getState())).toBeNull();
    });
  });

  it("reads legal moves only from the server's list", () => {
    const store = storeWith(makeSnapshot(5));
    store.setState({ connection: "live" });
    const state = store.getState();
    expect(selectCanMove(state)).toBe(true);
    expect(selectLegalPieceIds(state)).toEqual(["R1"]);
    expect(selectLegalMoveFor("R1")(state)?.toStep).toBe(1);
    expect(selectLegalMoveFor("R2")(state)).toBeNull();
  });

  describe("choosing a move", () => {
    const ONE_MOVE = rollTurn.legalMoves;
    const TWO_MOVES = [...ONE_MOVE, { pieceId: "R2", fromStep: 3, toStep: 9, captures: [] }];

    function liveStore(overrides: Partial<GameStateSnapshot> = {}, myPlayerId = "p1"): GameStore {
      const store = storeWith(makeSnapshot(5, overrides), myPlayerId);
      store.setState({ connection: "live" });
      return store;
    }

    it("offers the server's moves on my move", () => {
      const state = liveStore().getState();
      expect(selectMoveOffered(state)).toBe(true);
      expect(selectMoveOptions(state).map(({ pieceId }) => pieceId)).toEqual(["R1"]);
    });

    it("offers nothing on someone else's turn, even if the list has moves", () => {
      const state = liveStore({}, "p2").getState();
      expect(selectMoveOffered(state)).toBe(false);
      expect(selectMoveOptions(state)).toEqual([]);
    });

    it("offers nothing in the roll phase", () => {
      expect(selectMoveOffered(liveStore({ turn: awaitingRoll }).getState())).toBe(false);
    });

    it("never offers an empty choice", () => {
      const turn = { ...rollTurn, legalMoves: [] };
      expect(selectMoveOffered(liveStore({ turn }).getState())).toBe(false);
    });

    describe("when the server plays a lone option itself", () => {
      const rules = { ...defaultRules, autoMoveSingleOption: true };

      it("offers no choice for one move", () => {
        const state = liveStore({ rules }).getState();
        expect(selectMoveOffered(state)).toBe(false);
        expect(selectTurnKind(state)).toBe("myAutoMove");
      });

      it("still offers two moves", () => {
        const turn = { ...rollTurn, legalMoves: TWO_MOVES };
        expect(selectMoveOffered(liveStore({ rules, turn }).getState())).toBe(true);
      });
    });

    it("leaves the moves on show but can't press while a command is pending", () => {
      const store = liveStore();
      store.setState({ pendingCommand: { id: 1, kind: "move", pieceId: "R1" } });
      expect(selectMoveOffered(store.getState())).toBe(true);
      expect(selectCanMove(store.getState())).toBe(false);
    });

    it.each(["connecting", "reconnecting", "lost", null] as const)(
      "can't press while the connection is %s",
      (connection) => {
        const store = liveStore();
        store.setState({ connection });
        expect(selectCanMove(store.getState())).toBe(false);
      },
    );

    it("describes a move using the server's steps and names who would be captured", () => {
      const turn = {
        ...rollTurn,
        legalMoves: [{ pieceId: "R2", fromStep: 3, toStep: 9, captures: ["Y1"] }],
      };

      const [option] = selectMoveOptions(liveStore({ turn }).getState());

      expect(option?.number).toBe("2");
      expect(option?.phrase).toBe("move 6 squares and capture Computer's piece");
    });

    it("gives back the same list until the snapshot changes", () => {
      const state = liveStore().getState();
      expect(selectMoveOptions(state)).toBe(selectMoveOptions(state));
    });
  });

  describe("a roll with no move", () => {
    const noMoves = { ...rollTurn, legalMoves: [] };

    it("is reported for me", () => {
      expect(selectTurnKind(storeWith(makeSnapshot(5, { turn: noMoves })).getState())).toBe("noMove");
    });

    it("is reported for anyone else", () => {
      const turn = { ...noMoves, activePlayerId: "p2" };
      expect(selectTurnKind(storeWith(makeSnapshot(5, { turn })).getState())).toBe("noMove");
    });
  });

  describe("move", () => {
    it("gives back the version of an accepted move", async () => {
      const { adapter, store } = makeStore();
      adapter.queueAck({ ok: true, version: 9 });

      await expect(store.getState().move("R1")).resolves.toBe(9);
    });

    it("gives back null for a refused move", async () => {
      const { adapter, store } = makeStore();
      adapter.queueAck(rejection("ILLEGAL_MOVE"));

      await expect(store.getState().move("R1")).resolves.toBeNull();
    });
  });

  it("recognises a computer's turn", () => {
    const turn = { ...rollTurn, activePlayerId: "p2" };
    expect(selectIsComputerTurn(storeWith(makeSnapshot(5, { turn })).getState())).toBe(true);
  });

  it("counts progress per player from the snapshot", () => {
    const state = storeWith(makeSnapshot(5)).getState();
    expect(selectProgress("p1")(state)).toEqual({ base: 1, track: 1, home: 0 });
    expect(selectProgress("p2")(state)).toEqual({ base: 0, track: 0, home: 1 });
    expect(selectProgress("nobody")(state)).toBeNull();
  });

  it("lists every player with their counts, in the order the server sent", () => {
    const snapshot = makeSnapshot(5);
    const [first, second] = snapshot.players;
    if (!first || !second) throw new Error("the fixture has two players");
    const reversed = makeSnapshot(5, { players: [second, first] });

    expect(selectPlayerProgress(storeWith(reversed).getState())).toEqual([
      { player: second, counts: { base: 0, track: 0, home: 1 } },
      { player: first, counts: { base: 1, track: 1, home: 0 } },
    ]);
  });

  it("lists no players before there is a snapshot", () => {
    expect(selectPlayerProgress(makeStore().store.getState())).toEqual([]);
  });

  it("groups pieces by the cell they sit on", () => {
    const snapshot = makeSnapshot(5);
    const state = storeWith(snapshot).getState();
    const [, onTrack] = snapshot.pieces;
    if (!onTrack) throw new Error("the fixture has at least two pieces");

    expect(selectPiecesByCell(state).get(cellKey(pieceCell(onTrack)))).toEqual([onTrack]);
  });

  it("works out seconds left from the clock, so the last second reads 0", () => {
    const now = Date.parse("2026-11-08T10:00:00.000Z");
    expect(secondsUntil("2026-11-08T10:00:01.200Z", now)).toBe(1);
    expect(secondsUntil("2026-11-08T10:00:00.900Z", now)).toBe(0);
    expect(secondsUntil("2026-11-08T09:59:00.000Z", now)).toBe(0);
    expect(secondsUntil(null, now)).toBeNull();
    expect(secondsUntil("not a date", now)).toBeNull();
  });

  it("counts down to the deadline and stops at zero", () => {
    const deadline = "2026-11-08T10:00:30.000Z";
    const state = storeWith(makeSnapshot(5, { turn: { ...rollTurn, deadline } })).getState();

    expect(selectSecondsLeft(Date.parse("2026-11-08T10:00:00.000Z"))(state)).toBe(30);
    expect(selectSecondsLeft(Date.parse("2026-11-08T10:01:00.000Z"))(state)).toBe(0);
    expect(selectSecondsLeft(0)(storeWith(makeSnapshot(5)).getState())).toBeNull();
  });

  it("reads the host from the room", () => {
    const { store } = makeStore();
    store.setState({ room: makeRoom(), myPlayerId: "p1" });
    expect(selectIsHost(store.getState())).toBe(true);
    expect(selectHostName(store.getState())).toBe("Rida");

    store.setState({ myPlayerId: "p2" });
    expect(selectIsHost(store.getState())).toBe(false);
  });

  it("is nobody's host before there is a room", () => {
    const { store } = makeStore();
    expect(selectIsHost(store.getState())).toBe(false);
    expect(selectHostName(store.getState())).toBeNull();
  });

  // Zustand 5 re-renders forever if these return a new object each time.
  it("returns the same object for the same snapshot", () => {
    const state = storeWith(makeSnapshot(5)).getState();
    expect(selectLegalPieceIds(state)).toBe(selectLegalPieceIds(state));
    expect(selectPiecesByCell(state)).toBe(selectPiecesByCell(state));
    expect(selectProgress("p1")(state)).toBe(selectProgress("p1")(state));
    expect(selectPlayerProgress(state)).toBe(selectPlayerProgress(state));
  });
});
