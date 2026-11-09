import { act, fireEvent, renderHook } from "@testing-library/react";
import { FakeAdapter } from "@/adapter/FakeAdapter";
import type { GameStateSnapshot, LegalMove } from "@/contract/types";
import { useMoveSelection } from "@/interaction/useMoveSelection";
import { FIXTURE_PLAYER_ID, FIXTURES } from "@/mock/fixtures";
import { createGameStore } from "@/store/gameStore";

const LIMIT_MS = 2000;
const R2_MOVE: LegalMove = { pieceId: "R2", fromStep: 7, toStep: 10, captures: [] };
const R4_MOVE: LegalMove = { pieceId: "R4", fromStep: 54, toStep: 57, captures: [] };

function choosing(legalMoves: LegalMove[] = [R2_MOVE, R4_MOVE]): GameStateSnapshot {
  const spread = FIXTURES.spread;
  if (!spread) throw new Error("the spread fixture exists");
  return {
    ...spread,
    turn: {
      ...spread.turn,
      activePlayerId: FIXTURE_PLAYER_ID,
      phase: "AWAITING_MOVE",
      lastRoll: 3,
      legalMoves,
    },
  };
}

function after(snapshot: GameStateSnapshot): GameStateSnapshot {
  return {
    ...snapshot,
    version: snapshot.version + 1,
    turn: { ...snapshot.turn, activePlayerId: "p2", phase: "AWAITING_ROLL", legalMoves: [] },
  };
}

const ACCEPTED = { ok: true, version: choosing().version + 1 } as const;
const REFUSED = { ok: false, error: { code: "ILLEGAL_MOVE", message: "Not that one." } } as const;

function setup(snapshot = choosing(), startPaused = false) {
  const adapter = new FakeAdapter();
  const store = createGameStore(adapter);
  store.getState().listen();
  store.getState().applySnapshot(snapshot);
  store.setState({ myPlayerId: FIXTURE_PLAYER_ID, connection: "live" });
  const focusAfterMove = { current: document.createElement("button") };
  document.body.appendChild(focusAfterMove.current);
  const view = renderHook(
    ({ paused }: { paused: boolean }) => useMoveSelection(store, focusAfterMove, paused),
    { initialProps: { paused: startPaused } },
  );
  return { adapter, store, focusAfterMove, ...view };
}

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe("useMoveSelection", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("lists only what the server listed", () => {
    const { result } = setup();

    expect(result.current.options.map(({ pieceId }) => pieceId)).toEqual(["R2", "R4"]);
    expect(result.current.selected).toBeNull();
  });

  // FR-SYS-03 POST-03-1
  it("won't choose a piece the server didn't list", () => {
    const { result } = setup();

    act(() => result.current.pick("R1"));

    expect(result.current.selected).toBeNull();
  });

  it("chooses on the first press and sends nothing", () => {
    const { adapter, result } = setup();

    act(() => result.current.pick("R2"));

    expect(result.current.selected?.pieceId).toBe("R2");
    expect(adapter.commands).toEqual([]);
  });

  it("sends on a second press of the same piece", async () => {
    const { adapter, result } = setup();
    adapter.queueAck(ACCEPTED);
    act(() => result.current.pick("R2"));

    act(() => result.current.pick("R2"));

    expect(adapter.commands).toEqual([{ name: "move", pieceId: "R2" }]);
    await advance(LIMIT_MS);
  });

  it("changes its mind when another piece is pressed", () => {
    const { adapter, result } = setup();
    act(() => result.current.pick("R2"));

    act(() => result.current.pick("R4"));

    expect(result.current.selected?.pieceId).toBe("R4");
    expect(adapter.commands).toEqual([]);
  });

  it("cancels", () => {
    const { result } = setup();
    act(() => result.current.pick("R2"));

    act(() => result.current.cancel());

    expect(result.current.selected).toBeNull();
  });

  it("does nothing on confirm with no piece chosen", () => {
    const { adapter, result } = setup();

    act(() => result.current.confirm());

    expect(adapter.commands).toEqual([]);
  });

  // FR-SYS-02 EXC-02-1 applies to moves too.
  it("sends one move for a double press", async () => {
    const { adapter, result } = setup();
    const release = adapter.holdNextAck();
    act(() => result.current.pick("R2"));

    act(() => {
      result.current.confirm();
      result.current.confirm();
    });

    expect(adapter.commands).toHaveLength(1);
    release(ACCEPTED);
    await advance(LIMIT_MS);
  });

  // Contract §4: the die lands, then the moves appear. Sooner would give away the roll.
  describe("while the die is landing", () => {
    it("offers nothing", () => {
      const { result } = setup(choosing(), true);

      expect(result.current.options).toEqual([]);
    });

    it("ignores every way of choosing", () => {
      const { adapter, result } = setup(choosing(), true);
      fireEvent.keyDown(window, { key: "Tab" });

      act(() => result.current.pick("R2"));
      act(() => result.current.preview("R2"));
      act(() => result.current.pickNumber("2"));
      act(() => result.current.confirm());

      expect(result.current.selected).toBeNull();
      expect(adapter.commands).toEqual([]);
    });

    it("offers the moves once it has landed", () => {
      const { result, rerender } = setup(choosing(), true);

      rerender({ paused: false });

      expect(result.current.options).toHaveLength(2);
    });

    it("doesn't take the keyboard away when the options appear", () => {
      const { focusAfterMove, rerender } = setup(choosing(), true);

      rerender({ paused: false });

      expect(document.activeElement).not.toBe(focusAfterMove.current);
    });
  });

  describe("after sending", () => {
    // NFR-SYS-01
    it("locks at once and keeps the choice on screen", async () => {
      const { adapter, result } = setup();
      const release = adapter.holdNextAck();
      act(() => result.current.pick("R2"));

      act(() => result.current.confirm());

      expect(result.current.sending).toBe(true);
      expect(result.current.locked).toBe(true);
      expect(result.current.selected?.pieceId).toBe("R2");
      release(ACCEPTED);
      await advance(LIMIT_MS);
    });

    it("ignores other presses while the move is on its way", async () => {
      const { adapter, result } = setup();
      const release = adapter.holdNextAck();
      act(() => result.current.pick("R2"));
      act(() => result.current.confirm());

      act(() => {
        result.current.pick("R4");
        result.current.cancel();
      });

      expect(result.current.selected?.pieceId).toBe("R2");
      release(ACCEPTED);
      await advance(LIMIT_MS);
    });

    // The contract doesn't say which comes first.
    it("stays locked when the reply comes before the state", async () => {
      const { adapter, result } = setup();
      adapter.queueAck(ACCEPTED);
      act(() => result.current.pick("R2"));
      act(() => result.current.confirm());

      await advance(500);
      expect(result.current.locked).toBe(true);

      act(() => adapter.pushState(after(choosing())));
      await advance(0);
      expect(result.current.sending).toBe(false);
      expect(result.current.options).toEqual([]);
    });

    it("finishes when the state comes before the reply", async () => {
      const { adapter, result } = setup();
      const release = adapter.holdNextAck();
      act(() => result.current.pick("R2"));
      act(() => result.current.confirm());

      act(() => adapter.pushState(after(choosing())));
      expect(result.current.sending).toBe(true);

      release(ACCEPTED);
      await advance(0);
      expect(result.current.sending).toBe(false);
    });

    it("unlocks by itself if an accepted move's state never arrives", async () => {
      const { adapter, result } = setup();
      adapter.queueAck(ACCEPTED);
      act(() => result.current.pick("R2"));
      act(() => result.current.confirm());

      await advance(LIMIT_MS - 1);
      expect(result.current.sending).toBe(true);

      await advance(1);
      expect(result.current.sending).toBe(false);
    });

    // FR-SYS-04 POST-04-1
    it("drops the choice and keeps the game when the server refuses", async () => {
      const { adapter, store, result } = setup();
      const before = store.getState().snapshot;
      adapter.queueAck(REFUSED);
      act(() => result.current.pick("R2"));

      act(() => result.current.confirm());
      await advance(0);

      expect(result.current.selected).toBeNull();
      expect(result.current.locked).toBe(false);
      expect(store.getState().snapshot).toBe(before);
    });

    it("can try again after a refusal", async () => {
      const { adapter, result } = setup();
      adapter.queueAck(REFUSED);
      act(() => result.current.pick("R2"));
      act(() => result.current.confirm());
      await advance(0);
      adapter.queueAck(ACCEPTED);

      act(() => result.current.pick("R2"));
      act(() => result.current.confirm());

      expect(adapter.commands).toHaveLength(2);
      await advance(LIMIT_MS);
    });
  });

  it("forgets the choice when the options go away, so it can't return next turn", () => {
    const { adapter, result } = setup();
    act(() => result.current.pick("R2"));

    act(() => adapter.pushState(after(choosing())));
    expect(result.current.selected).toBeNull();

    const nextTurn = choosing();
    act(() => adapter.pushState({ ...nextTurn, version: nextTurn.version + 2 }));
    expect(result.current.options).toHaveLength(2);
    expect(result.current.selected).toBeNull();
  });

  it("keeps the choice through a snapshot that doesn't change the options", () => {
    const { adapter, result } = setup();
    act(() => result.current.pick("R2"));

    const same = choosing();
    act(() => adapter.pushState({ ...same, version: same.version + 1 }));

    expect(result.current.selected?.pieceId).toBe("R2");
  });

  it("sends nothing while the connection isn't live", () => {
    const { adapter, store, result } = setup();
    act(() => result.current.pick("R2"));

    act(() => store.setState({ connection: "reconnecting" }));
    act(() => result.current.confirm());

    expect(result.current.locked).toBe(true);
    expect(adapter.commands).toEqual([]);
  });

  describe("keyboard focus", () => {
    it("chooses a piece when the keyboard lands on it", () => {
      const { result } = setup();
      fireEvent.keyDown(window, { key: "Tab" });

      act(() => result.current.preview("R2"));

      expect(result.current.selected?.pieceId).toBe("R2");
    });

    // Otherwise one click would choose the piece on focus and then send it on the click.
    it("ignores the focus that comes with a mouse press", () => {
      const { result } = setup();
      fireEvent.pointerDown(window);

      act(() => result.current.preview("R2"));

      expect(result.current.selected).toBeNull();
    });

    it("never sends", () => {
      const { adapter, result } = setup();
      fireEvent.keyDown(window, { key: "Tab" });

      act(() => result.current.preview("R2"));
      act(() => result.current.preview("R2"));

      expect(adapter.commands).toEqual([]);
    });
  });

  describe("number keys", () => {
    it("chooses the piece with that number and puts the keyboard on it", () => {
      const { result } = setup();
      const holder = document.body.appendChild(document.createElement("div"));
      holder.setAttribute("data-piece", "R4");
      const button = holder.appendChild(document.createElement("button"));

      act(() => result.current.pickNumber("4"));

      expect(result.current.selected?.pieceId).toBe("R4");
      expect(document.activeElement).toBe(button);
    });

    it("does nothing for a piece that can't move", () => {
      const { result } = setup();

      act(() => result.current.pickNumber("1"));

      expect(result.current.selected).toBeNull();
    });

    it("never sends, even pressed twice", () => {
      const { adapter, result } = setup();

      act(() => result.current.pickNumber("2"));
      act(() => result.current.pickNumber("2"));

      expect(adapter.commands).toEqual([]);
    });
  });

  // NFR-SYS-08
  describe("after the options go away", () => {
    it("puts the keyboard back when its piece stopped being a button", () => {
      const { adapter, focusAfterMove } = setup();
      expect(document.activeElement).toBe(document.body);

      act(() => adapter.pushState(after(choosing())));

      expect(document.activeElement).toBe(focusAfterMove.current);
    });

    it("leaves the keyboard alone if it is somewhere else", () => {
      const { adapter, focusAfterMove } = setup();
      const other = document.body.appendChild(document.createElement("button"));
      other.focus();

      act(() => adapter.pushState(after(choosing())));

      expect(document.activeElement).toBe(other);
      expect(document.activeElement).not.toBe(focusAfterMove.current);
    });

    it("doesn't take the keyboard when the options first appear", () => {
      const { focusAfterMove } = setup();

      expect(document.activeElement).not.toBe(focusAfterMove.current);
    });
  });
});
