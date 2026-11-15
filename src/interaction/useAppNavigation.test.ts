import { act, renderHook } from "@testing-library/react";
import { FakeAdapter } from "@/adapter/FakeAdapter";
import type { EventType } from "@/contract/events";
import type { GameStateSnapshot } from "@/contract/types";
import { ABANDON_WAIT_MS, useAppNavigation } from "@/interaction/useAppNavigation";
import { FIXTURES } from "@/mock/fixtures";
import { createGameStore } from "@/store/gameStore";
import { useUiStore } from "@/store/uiStore";
import { makeRoom } from "@/testRoom";

function start(): GameStateSnapshot {
  const snapshot = FIXTURES.start;
  if (!snapshot) throw new Error("the start fixture exists");
  return snapshot;
}

function setup(screen: "game" | "win" | "lobby" = "game") {
  useUiStore.setState({ screen, modal: null });
  const adapter = new FakeAdapter();
  const store = createGameStore(adapter);
  store.getState().listen();
  renderHook(() => useAppNavigation(store));

  function event(type: EventType, version = 1) {
    act(() => adapter.pushEvent({ v: "1.0.0", version, type, data: {} }));
  }
  function state(snapshot: GameStateSnapshot) {
    act(() => adapter.pushState(snapshot));
  }
  return { adapter, store, event, state };
}

const screen = () => useUiStore.getState().screen;

function wait(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

describe("useAppNavigation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("opens the game when a match starts", () => {
    const { event } = setup("lobby");

    event("GAME_STARTED");

    expect(screen()).toBe("game");
  });

  describe("a restart", () => {
    // FR-SYS-08: until the new match arrives there are only old pieces to draw.
    it("leaves the win screen only when the new match arrives", () => {
      const { event, state } = setup("win");
      state(start());

      event("GAME_RESTARTED");
      event("GAME_STARTED");
      expect(screen()).toBe("win");

      state({ ...start(), matchId: "another" });
      expect(screen()).toBe("game");
    });

    // Contract §8: this is what the real server sends when a running match is restarted.
    it("never shows the stopped screen when GAME_ABANDONED comes first", () => {
      const { event, state } = setup("game");
      state(start());

      event("GAME_ABANDONED");
      event("GAME_RESTARTED");
      wait(ABANDON_WAIT_MS * 2);

      expect(screen()).toBe("game");
    });

    it("cancels the stopped screen when only the new match follows", () => {
      const { event, state } = setup("game");
      state(start());

      event("GAME_ABANDONED");
      state({ ...start(), matchId: "another" });
      wait(ABANDON_WAIT_MS * 2);

      expect(screen()).toBe("game");
    });
  });

  it("shows the stopped screen when nothing follows GAME_ABANDONED", () => {
    const { event, state } = setup("game");
    state(start());

    event("GAME_ABANDONED");
    wait(ABANDON_WAIT_MS - 1);
    expect(screen()).toBe("game");

    wait(1);
    expect(screen()).toBe("stopped");
  });

  // NFR-SYS-04: where a refresh lands, from what the server says.
  describe("after a refresh", () => {
    function rejoining() {
      const context = setup("game");
      act(() => useUiStore.setState({ screen: "rejoining" }));
      act(() => context.store.setState({ myPlayerId: "p1", connection: "connecting" }));
      return context;
    }

    it("waits for the server", () => {
      rejoining();

      expect(screen()).toBe("rejoining");
    });

    it("goes back to a running game", () => {
      const { state } = rejoining();

      state(start());

      expect(screen()).toBe("game");
    });

    it("goes to the win screen if the match has finished", () => {
      const { state } = rejoining();

      state({ ...start(), status: "FINISHED" });

      expect(screen()).toBe("win");
    });

    it("says so if the match was closed", () => {
      const { state } = rejoining();

      state({ ...start(), status: "CLOSED" });

      expect(screen()).toBe("stopped");
    });

    it("goes to the lobby if the game hasn't started", () => {
      const { adapter } = rejoining();

      act(() => adapter.pushRoom(makeRoom({ status: "LOBBY" })));

      expect(screen()).toBe("lobby");
    });

    it("keeps waiting for the game when the room says it's running", () => {
      const { adapter } = rejoining();

      act(() => adapter.pushRoom(makeRoom({ status: "IN_PROGRESS" })));

      expect(screen()).toBe("rejoining");
    });

    it("goes to the main screen if the session can't be used", () => {
      const { adapter } = rejoining();

      act(() => adapter.pushConnection("lost"));

      expect(screen()).toBe("main");
    });

    it("goes to the main screen if the server ended the session", () => {
      const { store } = rejoining();

      act(() => store.getState().forgetRoom());

      expect(screen()).toBe("main");
    });

    it("stays put for the card if another tab has the game", () => {
      const { store } = rejoining();

      act(() => store.setState({ connection: "lost", sessionReplaced: true }));

      expect(screen()).toBe("rejoining");
    });
  });

  it("goes to the main screen when the room goes away, and forgets any stop", () => {
    const { event, state, store } = setup("game");
    act(() => store.setState({ room: makeRoom() }));
    state(start());
    event("GAME_ABANDONED");

    act(() => store.getState().forgetRoom());
    wait(ABANDON_WAIT_MS * 2);

    expect(screen()).toBe("main");
  });
});
