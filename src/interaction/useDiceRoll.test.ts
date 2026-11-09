import { act, renderHook } from "@testing-library/react";
import { FakeAdapter } from "@/adapter/FakeAdapter";
import type { GameStateSnapshot } from "@/contract/types";
import { useDiceRoll } from "@/interaction/useDiceRoll";
import { FIXTURE_PLAYER_ID, FIXTURES } from "@/mock/fixtures";
import { createGameStore } from "@/store/gameStore";

const TUMBLE_MS = 600;
const LANDING_LIMIT_MS = 2000;

function startSnapshot(): GameStateSnapshot {
  const start = FIXTURES.start;
  if (!start) throw new Error("the start fixture exists");
  return start;
}

function rolledSnapshot(lastRoll: number): GameStateSnapshot {
  const start = startSnapshot();
  return {
    ...start,
    version: start.version + 1,
    turn: { ...start.turn, phase: "AWAITING_MOVE", lastRoll },
  };
}

const ACCEPTED = { ok: true, version: startSnapshot().version + 1 } as const;

function setup(tumbleMs = TUMBLE_MS) {
  const adapter = new FakeAdapter();
  const store = createGameStore(adapter);
  store.getState().listen();
  store.getState().applySnapshot(startSnapshot());
  store.setState({ myPlayerId: FIXTURE_PLAYER_ID, connection: "live" });
  const { result } = renderHook(() => useDiceRoll(store, tumbleMs));
  return { adapter, store, result };
}

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe("useDiceRoll", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  // NFR-SYS-01, FR-SYS-02 EXC-02-1
  it("reacts at once and sends one roll for a double press", async () => {
    const { adapter, result } = setup();
    const release = adapter.holdNextAck();

    act(() => {
      result.current.roll();
      result.current.roll();
    });

    expect(result.current.rolling).toBe(true);
    expect(adapter.commands).toEqual([{ name: "roll" }]);

    release(ACCEPTED);
    await advance(TUMBLE_MS);
  });

  it("keeps tumbling for the shortest tumble even when the server is instant", async () => {
    const { adapter, result } = setup();
    adapter.queueAck(ACCEPTED);

    act(() => {
      result.current.roll();
      adapter.pushState(rolledSnapshot(4));
    });
    await advance(TUMBLE_MS - 1);
    expect(result.current.rolling).toBe(true);

    await advance(1);
    expect(result.current.rolling).toBe(false);
  });

  // POST-02-2: otherwise the die would land on the previous roll.
  it("waits for the new state when the reply comes first", async () => {
    const { adapter, result } = setup();
    adapter.queueAck(ACCEPTED);

    act(() => result.current.roll());
    await advance(TUMBLE_MS + 500);
    expect(result.current.rolling).toBe(true);

    act(() => adapter.pushState(rolledSnapshot(4)));
    await advance(0);
    expect(result.current.rolling).toBe(false);
  });

  it("lands when the state comes first and the reply comes later", async () => {
    const { adapter, result } = setup();
    const release = adapter.holdNextAck();

    act(() => {
      result.current.roll();
      adapter.pushState(rolledSnapshot(4));
    });
    await advance(TUMBLE_MS);
    expect(result.current.rolling).toBe(true); // nothing has been accepted yet

    release(ACCEPTED);
    await advance(0);
    expect(result.current.rolling).toBe(false);
  });

  // FR-SYS-02 EXC-02-2
  it("stops at once and keeps the game when the server refuses", async () => {
    const { adapter, store, result } = setup();
    const before = store.getState().snapshot;
    adapter.queueAck({ ok: false, error: { code: "SERVER_BUSY", message: "Busy." } });

    act(() => result.current.roll());
    await advance(0);

    expect(result.current.rolling).toBe(false);
    expect(store.getState().snapshot).toBe(before);
    expect(store.getState().toasts).toHaveLength(1);
  });

  it("can be pressed again after a refusal", async () => {
    const { adapter, result } = setup();
    adapter.queueAck({ ok: false, error: { code: "SERVER_BUSY", message: "Busy." } });
    act(() => result.current.roll());
    await advance(0);
    adapter.queueAck(ACCEPTED);

    act(() => result.current.roll());

    expect(adapter.commands).toEqual([{ name: "roll" }, { name: "roll" }]);
    await advance(LANDING_LIMIT_MS);
  });

  it("stops by itself if an accepted roll's state never arrives", async () => {
    const { adapter, result } = setup();
    adapter.queueAck(ACCEPTED);

    act(() => result.current.roll());
    await advance(LANDING_LIMIT_MS - 1);
    expect(result.current.rolling).toBe(true);

    await advance(1);
    expect(result.current.rolling).toBe(false);
  });

  // POST-10-2: with animation off it lands on the same value, only sooner.
  it("lands as soon as the state is there when animation is off", async () => {
    const { adapter, result } = setup(0);
    adapter.queueAck(ACCEPTED);

    act(() => {
      result.current.roll();
      adapter.pushState(rolledSnapshot(4));
    });
    await advance(0);

    expect(result.current.rolling).toBe(false);
  });

  // D2 FR-38
  it("stops tumbling early on skip", async () => {
    const { adapter, result } = setup();
    adapter.queueAck(ACCEPTED);
    act(() => {
      result.current.roll();
      adapter.pushState(rolledSnapshot(4));
    });
    await advance(100);
    expect(result.current.rolling).toBe(true);

    act(() => result.current.skip());
    await advance(0);

    expect(result.current.rolling).toBe(false);
  });

  // NFR-SYS-05: skipping must never show a value the server hasn't sent yet.
  it("still waits for the server's value after a skip", async () => {
    const { adapter, result } = setup();
    adapter.queueAck(ACCEPTED);
    act(() => result.current.roll());

    act(() => result.current.skip());
    await advance(100);
    expect(result.current.rolling).toBe(true);

    act(() => adapter.pushState(rolledSnapshot(4)));
    await advance(0);
    expect(result.current.rolling).toBe(false);
  });

  it("does nothing on skip when no die is tumbling", () => {
    const { result } = setup();

    expect(() => act(() => result.current.skip())).not.toThrow();
    expect(result.current.rolling).toBe(false);
  });

  it("does nothing when the roll isn't allowed", () => {
    const { adapter, store, result } = setup();
    store.setState({ connection: "reconnecting" });

    act(() => result.current.roll());

    expect(result.current.rolling).toBe(false);
    expect(adapter.commands).toEqual([]);
  });
});
