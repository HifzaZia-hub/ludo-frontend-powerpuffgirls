import { FakeAdapter } from "@/adapter/FakeAdapter";
import { defaultRules } from "@/config/defaultRules";
import { pieceCell } from "@/config/geometry";
import type { GameStateSnapshot, RoomSnapshot, ServerError, TurnState } from "@/contract/types";
import {
  cellKey,
  createGameStore,
  selectActivePlayer,
  selectCanMove,
  selectCanRoll,
  selectIsComputerTurn,
  selectIsMyTurn,
  selectLegalMoveFor,
  selectLegalPieceIds,
  selectMe,
  selectPiecesByCell,
  selectProgress,
  selectSecondsLeft,
  type GameStore,
} from "@/store/gameStore";

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

describe("starting the debug game", () => {
  const room = { roomCode: "K7QX2M" } as RoomSnapshot;

  it("connects with the returned token and starts the match", async () => {
    const { adapter, store } = makeStore();
    adapter.createRoomResult = {
      ok: true,
      data: { v: "1.0.0", roomCode: "K7QX2M", playerId: "p1", sessionToken: "secret", room },
    };

    await store.getState().startDebugGame();

    expect(adapter.connectedToken).toBe("secret");
    expect(store.getState().myPlayerId).toBe("p1");
    expect(adapter.commands).toEqual([{ name: "start", fillEmptySeatsWithAi: false }]);
  });

  it("does not connect when the room can't be created", async () => {
    const { adapter, store } = makeStore();
    adapter.createRoomResult = rejection("SERVER_BUSY");

    await store.getState().startDebugGame();

    expect(adapter.connectedToken).toBeNull();
    expect(store.getState().toasts[0]?.message).toBe(
      "The game server is busy. Try again in a minute.",
    );
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

  it("allows a roll only on my turn, in the roll phase, with nothing pending", () => {
    const store = storeWith(makeSnapshot(5, { turn: awaitingRoll }));
    expect(selectCanRoll(store.getState())).toBe(true);
    expect(selectCanMove(store.getState())).toBe(false);

    store.setState({ pendingCommand: { id: 1, kind: "roll" } });
    expect(selectCanRoll(store.getState())).toBe(false);

    const notMine = storeWith(makeSnapshot(5, { turn: awaitingRoll }), "p2").getState();
    expect(selectCanRoll(notMine)).toBe(false);
  });

  it("reads legal moves only from the server's list", () => {
    const state = storeWith(makeSnapshot(5)).getState();
    expect(selectCanMove(state)).toBe(true);
    expect(selectLegalPieceIds(state)).toEqual(["R1"]);
    expect(selectLegalMoveFor("R1")(state)?.toStep).toBe(1);
    expect(selectLegalMoveFor("R2")(state)).toBeNull();
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

  it("groups pieces by the cell they sit on", () => {
    const snapshot = makeSnapshot(5);
    const state = storeWith(snapshot).getState();
    const [, onTrack] = snapshot.pieces;
    if (!onTrack) throw new Error("the fixture has at least two pieces");

    expect(selectPiecesByCell(state).get(cellKey(pieceCell(onTrack)))).toEqual([onTrack]);
  });

  it("counts down to the deadline and stops at zero", () => {
    const deadline = "2026-11-08T10:00:30.000Z";
    const state = storeWith(makeSnapshot(5, { turn: { ...rollTurn, deadline } })).getState();

    expect(selectSecondsLeft(Date.parse("2026-11-08T10:00:00.000Z"))(state)).toBe(30);
    expect(selectSecondsLeft(Date.parse("2026-11-08T10:01:00.000Z"))(state)).toBe(0);
    expect(selectSecondsLeft(0)(storeWith(makeSnapshot(5)).getState())).toBeNull();
  });

  // Zustand 5 re-renders forever if these return a new object each time.
  it("returns the same object for the same snapshot", () => {
    const state = storeWith(makeSnapshot(5)).getState();
    expect(selectLegalPieceIds(state)).toBe(selectLegalPieceIds(state));
    expect(selectPiecesByCell(state)).toBe(selectPiecesByCell(state));
    expect(selectProgress("p1")(state)).toBe(selectProgress("p1")(state));
  });
});
