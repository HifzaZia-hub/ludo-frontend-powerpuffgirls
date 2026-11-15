import { describe, expect, it } from "vitest";
import { FakeAdapter } from "@/adapter/FakeAdapter";
import type { GameStateSnapshot, TurnState } from "@/contract/types";
import { logComputerTurns, TIMING_TAG } from "@/feedback/aiTimings";
import { FIXTURES } from "@/mock/fixtures";
import { createGameStore } from "@/store/gameStore";

const COMPUTER = "p4"; // "Computer 1" in the fixtures
const ME = "p1";

function base(): GameStateSnapshot {
  const snapshot = FIXTURES.start;
  if (!snapshot) throw new Error("the start fixture is missing");
  return snapshot;
}

function at(version: number, turn: Partial<TurnState>, extra: Partial<GameStateSnapshot> = {}) {
  const start = base();
  return {
    ...start,
    ...extra,
    version,
    turn: { ...start.turn, lastRoll: null, legalMoves: [], ...turn },
  } satisfies GameStateSnapshot;
}

function setUp() {
  const store = createGameStore(new FakeAdapter());
  const lines: string[] = [];
  let clock = 0;
  logComputerTurns(
    store,
    (line) => lines.push(line),
    () => clock,
  );
  return {
    lines,
    show: (snapshot: GameStateSnapshot, when: number) => {
      clock = when;
      store.getState().applySnapshot(snapshot);
    },
  };
}

describe("logComputerTurns", () => {
  it("times a computer's turn from being asked to roll to the next roll", () => {
    const { lines, show } = setUp();

    show(at(1, { activePlayerId: COMPUTER, phase: "AWAITING_ROLL" }), 1000);
    show(at(2, { activePlayerId: COMPUTER, phase: "AWAITING_MOVE", lastRoll: 4 }), 1700);
    show(at(3, { activePlayerId: ME, phase: "AWAITING_ROLL" }), 2450);

    expect(lines).toEqual([`${TIMING_TAG} Computer 1's turn took 1450 ms`]);
  });

  it("times each extra turn on its own", () => {
    const { lines, show } = setUp();

    show(at(1, { activePlayerId: COMPUTER, phase: "AWAITING_ROLL" }), 0);
    show(at(2, { activePlayerId: COMPUTER, phase: "AWAITING_MOVE", lastRoll: 6 }), 700);
    show(at(3, { activePlayerId: COMPUTER, phase: "AWAITING_ROLL" }), 1400);
    show(at(4, { activePlayerId: ME, phase: "AWAITING_ROLL" }), 2100);

    expect(lines).toEqual([
      `${TIMING_TAG} Computer 1's turn took 1400 ms`,
      `${TIMING_TAG} Computer 1's turn took 700 ms`,
    ]);
  });

  it("ends the last turn when the match finishes", () => {
    const { lines, show } = setUp();

    show(at(1, { activePlayerId: COMPUTER, phase: "AWAITING_ROLL" }), 0);
    show(
      at(
        2,
        { activePlayerId: COMPUTER, phase: "AWAITING_MOVE" },
        { status: "FINISHED", winnerId: COMPUTER },
      ),
      900,
    );

    expect(lines).toEqual([`${TIMING_TAG} Computer 1's turn took 900 ms`]);
  });

  it("says nothing about a person's turn", () => {
    const { lines, show } = setUp();

    show(at(1, { activePlayerId: ME, phase: "AWAITING_ROLL" }), 0);
    show(at(2, { activePlayerId: ME, phase: "AWAITING_MOVE", lastRoll: 2 }), 5000);
    show(at(3, { activePlayerId: ME, phase: "AWAITING_ROLL" }), 9000);

    expect(lines).toEqual([]);
  });

  it("drops a turn that a restart cut short", () => {
    const { lines, show } = setUp();

    show(at(1, { activePlayerId: COMPUTER, phase: "AWAITING_ROLL" }), 0);
    show(
      at(1, { activePlayerId: ME, phase: "AWAITING_ROLL" }, { matchId: "another-match" }),
      60000,
    );

    expect(lines).toEqual([]);
  });
});
