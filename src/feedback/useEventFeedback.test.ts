import { act, renderHook } from "@testing-library/react";
import type { EventType, ServerEvent } from "@/contract/events";
import type { GameStateSnapshot } from "@/contract/types";
import type { EventTimings } from "@/feedback/motion";
import { playSound } from "@/feedback/sound";
import { useEventFeedback } from "@/feedback/useEventFeedback";
import { FIXTURES } from "@/mock/fixtures";

vi.mock("@/feedback/sound", () => ({
  listenForFirstGesture: () => () => undefined,
  playSound: vi.fn(),
}));

const ON: EventTimings = { stepMs: 120, flashMs: 150, returnMs: 400, finishMs: 400 };
const OFF: EventTimings = { stepMs: 0, flashMs: 0, returnMs: 0, finishMs: 0 };
const BANNER_MS = 1000;

// In the spread fixture Rida's pieces are on 0, 7, 30 and 54, and Hamza's third is on 14.
function ridasTurn(): GameStateSnapshot {
  const spread = FIXTURES.spread;
  if (!spread) throw new Error("the spread fixture exists");
  return { ...spread, turn: { ...spread.turn, activePlayerId: "p1", lastRoll: 4 } };
}

function next(
  from: GameStateSnapshot,
  steps: Record<string, number> = {},
  changes: Partial<GameStateSnapshot> = {},
): GameStateSnapshot {
  return {
    ...from,
    version: from.version + 1,
    pieces: from.pieces.map((piece) => {
      const step = steps[piece.id];
      return step === undefined ? piece : { ...piece, step };
    }),
    ...changes,
  };
}

function eventsAt(version: number, ...types: EventType[]): ServerEvent[] {
  return types.map((type) => ({ v: "1.0.0", version, type, data: {} }));
}

interface Props {
  snapshot: GameStateSnapshot | null;
  eventLog: readonly ServerEvent[];
  soundOn?: boolean;
  errorId?: number | null;
}

function setup(first: GameStateSnapshot | null, timings = ON, eventLog: readonly ServerEvent[] = []) {
  return renderHook(
    ({ snapshot, eventLog: log, soundOn = true, errorId = null }: Props) =>
      useEventFeedback({
        snapshot,
        eventLog: log,
        myPlayerId: "p1",
        timings,
        soundOn,
        errorId,
      }),
    { initialProps: { snapshot: first, eventLog } as Props },
  );
}

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

function texts(result: { current: { messages: readonly { text: string }[] } }): string[] {
  return result.current.messages.map(({ text }) => text);
}

describe("useEventFeedback", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(playSound).mockClear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  /** Rida rolls a 3, then lands on Hamza's piece and earns another turn. */
  function capture(timings = ON) {
    const start = ridasTurn();
    const view = setup(start, timings);
    const rolled = next(start, {}, { turn: { ...start.turn, lastRoll: 3 } });
    const log = eventsAt(rolled.version, "ROLLED");
    view.rerender({ snapshot: rolled, eventLog: log });

    const moved = next(rolled, { R2: 10, G3: 0 });
    const moveLog = [...log, ...eventsAt(moved.version, "MOVED", "CAPTURED", "BONUS_TURN")];
    view.rerender({ snapshot: moved, eventLog: moveLog });
    return { ...view, moved, moveLog };
  }

  // FR-SYS-05, the done-when for this task.
  describe("a capture plays in order, one thing at a time", () => {
    it("first walks, with the captured piece still on its square and the roll line unchanged", () => {
      const { result } = capture();

      expect(result.current.held.get("G3")).toBe(14);
      expect(result.current.flashingId).toBeNull();
      expect(texts(result)).toEqual(["Rida rolled 3."]);
      expect(result.current.busy).toBe(true);
    });

    it("then flashes the captured piece and joins the roll line", () => {
      const { result } = capture();

      advance(3 * ON.stepMs);

      expect(result.current.flashingId).toBe("G3");
      expect(result.current.held.get("G3")).toBe(14);
      expect(texts(result)).toEqual(["Rida rolled 3 and captured Hamza's piece!"]);
    });

    it("then sends it home", () => {
      const { result } = capture();
      advance(3 * ON.stepMs);

      advance(ON.flashMs);

      expect(result.current.flashingId).toBeNull();
      expect(result.current.returningId).toBe("G3");
      expect(result.current.held.has("G3")).toBe(false);
    });

    it("and only then offers the extra turn", () => {
      const { result } = capture();
      advance(3 * ON.stepMs);
      advance(ON.flashMs);
      expect(result.current.banner).toBeNull();

      advance(ON.returnMs);

      expect(result.current.banner).toBe("Roll again!");
      expect(result.current.busy).toBe(false);
      expect(texts(result)).toEqual([
        "Rida rolled 3 and captured Hamza's piece!",
        "Rida rolls again!",
      ]);
    });

    it("plays each sound in the same order", () => {
      capture();
      expect(vi.mocked(playSound).mock.calls.map(([name]) => name)).toEqual(["roll", "move"]);

      advance(3 * ON.stepMs);

      expect(vi.mocked(playSound).mock.calls.map(([name]) => name)).toEqual([
        "roll",
        "move",
        "capture",
      ]);
    });
  });

  // POST-05-2
  describe("with animations off", () => {
    it("ends in the same words, with nothing held and nothing still playing", () => {
      const { result } = capture(OFF);

      expect(result.current.busy).toBe(false);
      expect(result.current.held.size).toBe(0);
      expect(texts(result)).toEqual([
        "Rida rolled 3 and captured Hamza's piece!",
        "Rida rolls again!",
      ]);
    });

    it("plays only the last sound of an instant run, so they don't pile up", () => {
      capture(OFF);

      expect(vi.mocked(playSound).mock.calls.map(([name]) => name)).toEqual(["roll", "capture"]);
    });
  });

  // EXC-05-1
  describe("never invents an event", () => {
    it("shows no capture when the server sent none, even if a piece went back", () => {
      const start = ridasTurn();
      const { result, rerender } = setup(start);

      rerender({ snapshot: next(start, { G3: 0 }), eventLog: [] });

      expect(result.current.held.size).toBe(0);
      expect(result.current.flashingId).toBeNull();
      expect(result.current.messages).toEqual([]);
    });

    it("says nothing across a version gap", () => {
      const start = ridasTurn();
      const { result, rerender } = setup(start);
      const later = { ...next(start, { R2: 10 }), version: start.version + 2 };

      rerender({ snapshot: later, eventLog: eventsAt(later.version, "MOVED") });

      expect(result.current.messages).toEqual([]);
    });

    it("waits for the state before acting on an event", () => {
      const start = ridasTurn();
      const { result, rerender } = setup(start);

      rerender({ snapshot: start, eventLog: eventsAt(start.version + 1, "ROLLED") });
      expect(result.current.messages).toEqual([]);

      const rolled = next(start);
      rerender({ snapshot: rolled, eventLog: eventsAt(rolled.version, "ROLLED") });
      expect(texts(result)).toEqual(["Rida rolled 4."]);
    });

    it("doesn't act twice on an event it has already read", () => {
      const start = ridasTurn();
      const { result, rerender } = setup(start);
      const rolled = next(start);
      const log = eventsAt(rolled.version, "ROLLED");
      rerender({ snapshot: rolled, eventLog: log });

      rerender({ snapshot: next(rolled), eventLog: log });

      expect(result.current.messages).toHaveLength(1);
    });
  });

  it("sees every event when several arrive at once", () => {
    const start = ridasTurn();
    const { result, rerender } = setup(start, OFF);
    const finished = next(start, { R4: 57 });

    rerender({
      snapshot: finished,
      eventLog: eventsAt(finished.version, "MOVED", "PIECE_FINISHED", "BONUS_TURN"),
    });

    expect(texts(result)).toEqual([
      "Rida moved a piece 3 squares.",
      "Rida got a piece home!",
      "Rida rolls again!",
    ]);
  });

  describe("when the next change arrives while one is playing", () => {
    it("carries on through a change that moves no piece, then adds it", () => {
      const { result, rerender, moved, moveLog } = capture();
      advance(3 * ON.stepMs);

      const rolled = next(moved);
      rerender({ snapshot: rolled, eventLog: [...moveLog, ...eventsAt(rolled.version, "ROLLED")] });

      expect(result.current.flashingId).toBe("G3");
      expect(texts(result)).not.toContain("Rida rolled 3.");

      advance(ON.flashMs);
      advance(ON.returnMs);
      expect(texts(result)).toContain("Rida rolled 3.");
    });

    // The snapshot always wins.
    it("ends it at once when a piece has moved again, and keeps the words", () => {
      const { result, rerender, moved, moveLog } = capture();

      const again = next(moved, { Y1: 22 });
      rerender({ snapshot: again, eventLog: [...moveLog, ...eventsAt(again.version, "MOVED")] });

      expect(result.current.held.size).toBe(0);
      expect(result.current.flashingId).toBeNull();
      expect(texts(result)).toEqual([
        "Rida rolled 3 and captured Hamza's piece!",
        "Rida rolls again!",
        "Rida moved a piece 2 squares.",
      ]);
    });
  });

  // D2 FR-38
  describe("skip", () => {
    it("finishes everything at once and keeps the words", () => {
      const { result } = capture();

      act(() => result.current.skip());

      expect(result.current.busy).toBe(false);
      expect(result.current.held.size).toBe(0);
      expect(result.current.banner).toBeNull();
      expect(texts(result)).toEqual([
        "Rida rolled 3 and captured Hamza's piece!",
        "Rida rolls again!",
      ]);
    });

    it("doesn't play the sounds it skipped", () => {
      const { result } = capture();
      vi.mocked(playSound).mockClear();

      act(() => result.current.skip());
      advance(5000);

      expect(playSound).not.toHaveBeenCalled();
    });
  });

  describe("banners", () => {
    function bonus(activePlayerId: string) {
      const base = ridasTurn();
      const start = { ...base, turn: { ...base.turn, activePlayerId } };
      const view = setup(start, OFF);
      const after = next(start);
      view.rerender({ snapshot: after, eventLog: eventsAt(after.version, "BONUS_TURN") });
      return view;
    }

    it("tells me to roll again on my own bonus turn", () => {
      expect(bonus("p1").result.current.banner).toBe("Roll again!");
    });

    it("leaves other players to the message", () => {
      const { result } = bonus("p2");

      expect(result.current.banner).toBeNull();
      expect(texts(result)).toEqual(["Hamza rolls again!"]);
    });

    it("goes away by itself", () => {
      const { result } = bonus("p1");

      advance(BANNER_MS);

      expect(result.current.banner).toBeNull();
    });

    it("shows a skipped turn to everyone", () => {
      const start = ridasTurn();
      const { result, rerender } = setup(start, OFF);
      const passed = next(start);

      rerender({ snapshot: passed, eventLog: eventsAt(passed.version, "TURN_PASSED") });

      expect(result.current.banner).toBe("No move possible — turn skipped");
      expect(texts(result)).toEqual(["Rida can't move. Turn skipped."]);
    });
  });

  it("makes a finishing piece glow and bumps its owner's Home count", () => {
    const start = ridasTurn();
    const { result, rerender } = setup(start);
    const finished = next(start, { R4: 57 });
    rerender({
      snapshot: finished,
      eventLog: eventsAt(finished.version, "MOVED", "PIECE_FINISHED"),
    });
    expect(result.current.finishingId).toBeNull();

    advance(3 * ON.stepMs);

    expect(result.current.finishingId).toBe("R4");
    expect(result.current.bumpPlayerId).toBe("p1");

    advance(ON.finishMs);
    expect(result.current.finishingId).toBeNull();
    expect(result.current.bumpPlayerId).toBeNull();
  });

  it("flashes the sixes pips when a turn is forfeited", () => {
    const start = ridasTurn();
    const { result, rerender } = setup(start);
    const forfeited = next(start);

    rerender({
      snapshot: forfeited,
      eventLog: eventsAt(forfeited.version, "ROLLED", "TURN_FORFEITED", "TURN_CHANGED"),
    });

    expect(result.current.sixesFlash).toBe(true);
    expect(texts(result)).toEqual(["Rida rolled 4.", "Three 6s in a row — Rida's turn is over."]);

    advance(ON.finishMs);
    expect(result.current.sixesFlash).toBe(false);
  });

  // In the queue, not on arrival: the winning move's own events came in with GAME_OVER.
  it("still plays the winning move before the match ends", () => {
    const start = ridasTurn();
    const { result, rerender } = setup(start);
    const won = next(start, { R4: 57 }, { status: "FINISHED", winnerId: "p1" });

    rerender({
      snapshot: won,
      eventLog: eventsAt(won.version, "MOVED", "PIECE_FINISHED", "GAME_OVER"),
    });
    advance(3 * ON.stepMs);
    expect(result.current.finishingId).toBe("R4");

    advance(ON.finishMs);
    expect(texts(result)).toEqual([
      "Rida moved a piece 3 squares.",
      "Rida got a piece home!",
      "Rida wins!",
    ]);
    expect(vi.mocked(playSound).mock.calls.at(-1)?.[0]).toBe("win");
  });

  describe("the roll line", () => {
    it("only joins the same player's move", () => {
      const start = ridasTurn();
      const { result, rerender } = setup(start, OFF);
      const rolled = next(start);
      let log = eventsAt(rolled.version, "ROLLED");
      rerender({ snapshot: rolled, eventLog: log });

      const otherTurn = next(rolled, {}, { turn: { ...rolled.turn, activePlayerId: "p2" } });
      log = [...log, ...eventsAt(otherTurn.version, "TURN_CHANGED")];
      rerender({ snapshot: otherTurn, eventLog: log });

      const moved = next(otherTurn, { G3: 18 });
      rerender({ snapshot: moved, eventLog: [...log, ...eventsAt(moved.version, "MOVED")] });

      expect(texts(result)).toEqual(["Rida rolled 4.", "Hamza moved a piece 4 squares."]);
    });

    it("doesn't join a move once another line has come between", () => {
      const start = ridasTurn();
      const { result, rerender } = setup(start, OFF);
      const rolled = next(start);
      let log = eventsAt(rolled.version, "ROLLED");
      rerender({ snapshot: rolled, eventLog: log });

      const players = rolled.players.map((player) =>
        player.id === "p2" ? { ...player, connected: false } : player,
      );
      const dropped = next(rolled, {}, { players });
      log = [...log, ...eventsAt(dropped.version, "PLAYER_DISCONNECTED")];
      rerender({ snapshot: dropped, eventLog: log });

      const moved = next(dropped, { R2: 11 });
      rerender({ snapshot: moved, eventLog: [...log, ...eventsAt(moved.version, "MOVED")] });

      expect(texts(result)).toEqual([
        "Rida rolled 4.",
        "Hamza left. The computer will play for them.",
        "Rida moved a piece 4 squares.",
      ]);
    });
  });

  describe("starting and restarting", () => {
    // Contract §4: GAME_STARTED comes before the first state, and this screen may mount after both.
    it("reads an opening event that came before the screen opened", () => {
      const start = ridasTurn();

      const { result } = setup(start, ON, eventsAt(start.version, "GAME_STARTED"));

      expect(texts(result)).toEqual(["Game started. Rida goes first."]);
    });

    it("reads it when the first state arrives after the screen opened", () => {
      const start = ridasTurn();
      const { result, rerender } = setup(null);

      rerender({ snapshot: start, eventLog: eventsAt(start.version, "GAME_STARTED") });

      expect(texts(result)).toEqual(["Game started. Rida goes first."]);
    });

    it("starts a new log for a new match, and drops what was playing", () => {
      const { result, rerender, moveLog } = capture();
      const restarted = { ...ridasTurn(), matchId: "another", version: 1 };

      rerender({
        snapshot: restarted,
        eventLog: [...moveLog, ...eventsAt(1, "GAME_RESTARTED")],
      });

      expect(result.current.messages).toEqual([]);
      expect(result.current.busy).toBe(false);
      expect(result.current.held.size).toBe(0);
    });

    // A restart begins again at version 1, so old events can share a new event's version.
    it("doesn't replay the old match's events with the same version number", () => {
      const start = ridasTurn();
      const { result, rerender } = setup(start, OFF);
      const rolled = next(start);
      const oldLog = eventsAt(rolled.version, "ROLLED");
      rerender({ snapshot: rolled, eventLog: oldLog });

      const restarted = { ...start, matchId: "another" };
      rerender({ snapshot: restarted, eventLog: oldLog });
      rerender({ snapshot: { ...restarted, version: rolled.version }, eventLog: oldLog });

      expect(result.current.messages).toEqual([]);
    });
  });

  describe("sound", () => {
    it("passes on the player's setting", () => {
      const start = ridasTurn();
      const { rerender } = setup(start, OFF);
      const rolled = next(start);

      rerender({ snapshot: rolled, eventLog: eventsAt(rolled.version, "ROLLED"), soundOn: false });

      expect(playSound).toHaveBeenCalledWith("roll", false);
    });

    it("plays the error sound when the server refuses something", () => {
      const start = ridasTurn();
      const { rerender } = setup(start, OFF);

      rerender({ snapshot: start, eventLog: [], errorId: 7 });

      expect(playSound).toHaveBeenCalledWith("error", true);
    });

    it("doesn't play an old error when the screen opens", () => {
      const start = ridasTurn();
      renderHook(() =>
        useEventFeedback({
          snapshot: start,
          eventLog: [],
          myPlayerId: "p1",
          timings: OFF,
          soundOn: true,
          errorId: 3,
        }),
      );

      expect(playSound).not.toHaveBeenCalled();
    });

    it("doesn't replay a sound when the setting changes", () => {
      const start = ridasTurn();
      const { rerender } = setup(start, OFF);
      const rolled = next(start);
      const eventLog = eventsAt(rolled.version, "ROLLED");
      rerender({ snapshot: rolled, eventLog });
      vi.mocked(playSound).mockClear();

      rerender({ snapshot: rolled, eventLog, soundOn: false });

      expect(playSound).not.toHaveBeenCalled();
    });
  });
});
