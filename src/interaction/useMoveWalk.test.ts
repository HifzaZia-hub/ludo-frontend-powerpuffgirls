import { act, renderHook } from "@testing-library/react";
import type { GameStateSnapshot } from "@/contract/types";
import { useMoveWalk } from "@/interaction/useMoveWalk";
import { FIXTURES } from "@/mock/fixtures";

const STEP_MS = 120;

function spread(): GameStateSnapshot {
  const snapshot = FIXTURES.spread;
  if (!snapshot) throw new Error("the spread fixture exists");
  return snapshot;
}

/** The next version, with these pieces at these steps. */
function moved(
  from: GameStateSnapshot,
  steps: Record<string, number>,
  version = from.version + 1,
): GameStateSnapshot {
  return {
    ...from,
    version,
    pieces: from.pieces.map((piece) => {
      const step = steps[piece.id];
      return step === undefined ? piece : { ...piece, step };
    }),
  };
}

function setup(first: GameStateSnapshot | null = spread(), stepMs = STEP_MS) {
  return renderHook(
    ({ snapshot, ms }: { snapshot: GameStateSnapshot | null; ms: number }) =>
      useMoveWalk(snapshot, ms),
    { initialProps: { snapshot: first, ms: stepMs } },
  );
}

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

describe("useMoveWalk", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("isn't walking on the first snapshot", () => {
    expect(setup().result.current.walk).toBeNull();
  });

  // R2 is on step 7 in this fixture.
  it("walks every square between two accepted snapshots, starting at once", () => {
    const { result, rerender } = setup();

    rerender({ snapshot: moved(spread(), { R2: 10 }), ms: STEP_MS });
    expect(result.current.walk).toEqual({ pieceId: "R2", step: 8 });

    advance(STEP_MS);
    expect(result.current.walk).toEqual({ pieceId: "R2", step: 9 });

    advance(STEP_MS);
    expect(result.current.walk).toEqual({ pieceId: "R2", step: 10 });

    advance(STEP_MS);
    expect(result.current.walk).toBeNull();
  });

  it("leaves the yard in one hop", () => {
    const { result, rerender } = setup();

    rerender({ snapshot: moved(spread(), { R1: 1 }), ms: STEP_MS });
    expect(result.current.walk).toEqual({ pieceId: "R1", step: 1 });

    advance(STEP_MS);
    expect(result.current.walk).toBeNull();
  });

  // CLAUDE.md §1: this is drawing, and it follows any player, not only this one.
  it("walks another player's piece too", () => {
    const { result, rerender } = setup();

    rerender({ snapshot: moved(spread(), { G3: 16 }), ms: STEP_MS });

    expect(result.current.walk).toEqual({ pieceId: "G3", step: 15 });
  });

  // POST-05-2
  it("doesn't walk with animations off", () => {
    const { result, rerender } = setup(spread(), 0);

    rerender({ snapshot: moved(spread(), { R2: 10 }), ms: 0 });

    expect(result.current.walk).toBeNull();
  });

  // A computer's next roll comes 700 ms later, and stopping for it would cut captures short.
  it("keeps walking through a snapshot that moves no piece", () => {
    const { result, rerender } = setup();
    const afterMove = moved(spread(), { R2: 13 });
    rerender({ snapshot: afterMove, ms: STEP_MS });
    advance(STEP_MS);
    expect(result.current.walk?.step).toBe(9);

    rerender({ snapshot: moved(afterMove, {}), ms: STEP_MS });
    expect(result.current.walk?.step).toBe(9);

    advance(STEP_MS);
    expect(result.current.walk?.step).toBe(10);
  });

  // The snapshot always wins when it moves a piece.
  it("drops a walk the moment another piece moves", () => {
    const { result, rerender } = setup();
    const afterMove = moved(spread(), { R2: 13 });
    rerender({ snapshot: afterMove, ms: STEP_MS });
    advance(STEP_MS);

    // Two pieces at once has no single path to show, so nothing replaces the walk.
    rerender({ snapshot: moved(afterMove, { G3: 15, Y1: 21 }), ms: STEP_MS });

    expect(result.current.walk).toBeNull();
  });

  it("drops a walk when the match changes", () => {
    const { result, rerender } = setup();
    const afterMove = moved(spread(), { R2: 13 });
    rerender({ snapshot: afterMove, ms: STEP_MS });

    rerender({ snapshot: { ...afterMove, matchId: "another" }, ms: STEP_MS });

    expect(result.current.walk).toBeNull();
  });

  it("starts the new walk when the next snapshot moves another piece", () => {
    const { result, rerender } = setup();
    const afterMove = moved(spread(), { R2: 13 });
    rerender({ snapshot: afterMove, ms: STEP_MS });

    rerender({ snapshot: moved(afterMove, { G3: 15 }), ms: STEP_MS });

    expect(result.current.walk).toEqual({ pieceId: "G3", step: 15 });
  });

  it("doesn't walk across a version gap, where a piece may have moved twice", () => {
    const { result, rerender } = setup();

    rerender({ snapshot: moved(spread(), { R2: 10 }, spread().version + 2), ms: STEP_MS });

    expect(result.current.walk).toBeNull();
  });

  it("doesn't walk into a new match", () => {
    const { result, rerender } = setup();

    rerender({ snapshot: { ...moved(spread(), { R2: 10 }), matchId: "another" }, ms: STEP_MS });

    expect(result.current.walk).toBeNull();
  });

  // P9 draws the capture. A piece sent back to its yard isn't walking.
  it("doesn't walk a piece backwards", () => {
    const { result, rerender } = setup();

    rerender({ snapshot: moved(spread(), { R2: 0 }), ms: STEP_MS });

    expect(result.current.walk).toBeNull();
  });

  it("walks only the mover when the same snapshot captures a piece", () => {
    const { result, rerender } = setup();

    rerender({ snapshot: moved(spread(), { R2: 10, G3: 0 }), ms: STEP_MS });

    expect(result.current.walk).toEqual({ pieceId: "R2", step: 8 });
  });

  it("doesn't guess when two pieces moved at once", () => {
    const { result, rerender } = setup();

    rerender({ snapshot: moved(spread(), { R2: 10, R3: 31 }), ms: STEP_MS });

    expect(result.current.walk).toBeNull();
  });

  it("copes with the snapshot being taken away", () => {
    const { result, rerender } = setup();
    rerender({ snapshot: moved(spread(), { R2: 10 }), ms: STEP_MS });

    rerender({ snapshot: null, ms: STEP_MS });

    expect(result.current.walk).toBeNull();
  });

  // D2 FR-38
  it("ends at once on skip", () => {
    const { result, rerender } = setup();
    rerender({ snapshot: moved(spread(), { R2: 13 }), ms: STEP_MS });

    act(() => result.current.skip());

    expect(result.current.walk).toBeNull();
  });

  // D2 FR-38: "instantly" means no glide to the last square either.
  it("says it was skipped, until the next snapshot", () => {
    const { result, rerender } = setup();
    const afterMove = moved(spread(), { R2: 13 });
    rerender({ snapshot: afterMove, ms: STEP_MS });
    expect(result.current.skipped).toBe(false);

    act(() => result.current.skip());
    expect(result.current.skipped).toBe(true);

    rerender({ snapshot: moved(afterMove, { G3: 15 }), ms: STEP_MS });
    expect(result.current.skipped).toBe(false);
  });
});
