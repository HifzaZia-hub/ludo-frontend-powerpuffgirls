import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FakeAdapter } from "@/adapter/FakeAdapter";
import { App } from "@/App";
import type { GameStateSnapshot } from "@/contract/types";
import { createGameStore } from "@/store/gameStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useUiStore } from "@/store/uiStore";
import { makeRoom } from "@/testRoom";
import { defaultRules } from "@/config/defaultRules";

function renderApp() {
  const adapter = new FakeAdapter();
  const store = createGameStore(adapter);
  render(<App store={store} />);
  return { adapter, store, user: userEvent.setup() };
}

const openSettings = () => screen.getByRole("button", { name: "Settings" });

describe("App", () => {
  beforeEach(() => {
    sessionStorage.clear();
    useUiStore.setState({ screen: "main", modal: null });
    useSettingsStore.setState({ theme: "dark", sound: true, animation: "on" });
  });

  describe("main screen", () => {
    it("offers every way in", () => {
      renderApp();
      expect(screen.getByRole("heading", { name: "LUDO" })).toBeTruthy();
      for (const name of ["New Game", "Join Game", "How to play", "Settings"]) {
        expect(screen.getByRole("button", { name })).toBeTruthy();
      }
    });

    it("opens setup and puts focus at the top of it", async () => {
      const { user } = renderApp();

      await user.click(screen.getByRole("button", { name: "New Game" }));

      expect(screen.getByRole("heading", { name: "New game" })).toBe(document.activeElement);
    });

    it("opens the join form on the code field", async () => {
      const { user } = renderApp();

      await user.click(screen.getByRole("button", { name: "Join Game" }));

      expect(document.activeElement).toBe(screen.getByLabelText("Game code"));
    });

    // D2 FR-07
    it("opens the standard rules before any game exists", async () => {
      const { user } = renderApp();

      await user.click(screen.getByRole("button", { name: "How to play" }));

      expect(screen.getByText("Standard rules")).toBeTruthy();
      expect(screen.getByText("Capturing a piece gives you another turn.")).toBeTruthy();
    });
  });

  // NFR-SYS-11: once there is a room, its rules are the ones that count.
  it("shows the room's own rules in the lobby", async () => {
    const { store, user } = renderApp();
    act(() => {
      store.setState({
        room: makeRoom({ rules: { ...defaultRules, bonusOnCapture: false } }),
        myPlayerId: "p1",
      });
      useUiStore.getState().goTo("lobby");
    });

    await user.keyboard("?");

    expect(screen.queryByText("Standard rules")).toBeNull();
    expect(screen.queryByText("Capturing a piece gives you another turn.")).toBeNull();
    expect(screen.getByText("Rolling a 6 gives you another turn.")).toBeTruthy();
  });

  describe("settings", () => {
    it("changes the theme the moment it is pressed", async () => {
      const { user } = renderApp();

      await user.click(openSettings());
      await user.click(screen.getByRole("radio", { name: "Light" }));

      expect(document.documentElement.dataset.theme).toBe("light");

      await user.click(screen.getByRole("radio", { name: "Dark" }));

      expect(document.documentElement.dataset.theme).toBe("dark");
    });

    it("changes sound and animation", async () => {
      const { user } = renderApp();

      await user.click(openSettings());
      await user.click(screen.getByRole("switch", { name: "Sound effects" }));
      await user.click(screen.getByRole("radio", { name: "Fast" }));

      expect(useSettingsStore.getState().sound).toBe(false);
      expect(useSettingsStore.getState().animation).toBe("fast");
      expect(document.documentElement.dataset.animation).toBe("fast");
    });

    // FR-SYS-10 POST-10-2, POST-10-3
    it("never touches the game or talks to the server", async () => {
      const { adapter, store, user } = renderApp();
      act(() => {
        store.setState({
          room: makeRoom(),
          myPlayerId: "p1",
          snapshot: { version: 7, matchId: "match-1" } as GameStateSnapshot,
        });
      });
      const { snapshot, room } = store.getState();

      await user.click(openSettings());
      await user.click(screen.getByRole("radio", { name: "Light" }));
      await user.click(screen.getByRole("radio", { name: "Off" }));
      await user.click(screen.getByRole("switch", { name: "Sound effects" }));

      expect(store.getState().snapshot).toBe(snapshot);
      expect(store.getState().room).toBe(room);
      expect(adapter.commands).toEqual([]);
    });

    it.each(["setup", "lobby", "game"] as const)("can be opened on the %s screen", async (name) => {
      const { store, user } = renderApp();
      act(() => {
        store.setState({ room: makeRoom(), myPlayerId: "p1" });
        useUiStore.getState().goTo(name);
      });

      await user.click(openSettings());

      expect(screen.getByRole("radio", { name: "Light" })).toBeTruthy();
    });
  });

  describe("moving between screens", () => {
    it("opens the game screen on GAME_STARTED, for host and guest alike", () => {
      const { adapter, store } = renderApp();
      act(() => {
        store.setState({ room: makeRoom(), myPlayerId: "p2" });
        useUiStore.getState().goTo("lobby");
      });

      act(() => {
        adapter.pushEvent({ v: "1.0.0", version: 1, type: "GAME_STARTED", data: {} });
      });

      expect(useUiStore.getState().screen).toBe("game");
      // Contract §4: the event comes before the snapshot, and that must not crash.
      expect(screen.getByText("Getting the board ready…")).toBeTruthy();
    });

    it("ignores other events", () => {
      const { adapter } = renderApp();

      act(() => {
        adapter.pushEvent({ v: "1.0.0", version: 1, type: "ROLLED", data: {} });
      });

      expect(useUiStore.getState().screen).toBe("main");
    });

    it("isn't pulled back to the lobby by a reply that arrives after GAME_STARTED", () => {
      renderApp();

      act(() => {
        useUiStore.getState().goTo("game");
        useUiStore.getState().goToLobby();
      });

      expect(useUiStore.getState().screen).toBe("game");
    });

    // Contract §6
    it("returns to the main screen with a message when the session ends", () => {
      const { adapter, store } = renderApp();
      act(() => {
        store.setState({ room: makeRoom(), myPlayerId: "p1" });
        useUiStore.getState().goTo("lobby");
      });

      act(() => {
        adapter.pushError({ code: "UNAUTHORIZED", message: "Ended." });
      });

      expect(useUiStore.getState().screen).toBe("main");
      expect(screen.getByText("Your game session ended. Please start again.")).toBeTruthy();
    });
  });

  describe("keyboard shortcuts", () => {
    it("opens the rules with ?", async () => {
      const { user } = renderApp();

      await user.keyboard("?");

      expect(useUiStore.getState().modal).toBe("rules");
    });

    // docs/03-ui-spec.md §5: never take a key while the player is typing.
    it("leaves ? alone in a text field", async () => {
      const { user } = renderApp();
      await user.click(screen.getByRole("button", { name: "New Game" }));

      await user.type(screen.getByLabelText("Your name"), "?");

      expect(useUiStore.getState().modal).toBeNull();
      expect(screen.getByLabelText<HTMLInputElement>("Your name").value).toBe("?");
    });

    it("doesn't stack the rules on top of another window", async () => {
      const { user } = renderApp();
      await user.click(openSettings());

      await user.keyboard("?");

      expect(useUiStore.getState().modal).toBe("settings");
    });
  });

  describe("toasts", () => {
    it("shows an error and removes it when dismissed", async () => {
      const { adapter, user } = renderApp();
      act(() => {
        adapter.pushError({ code: "SERVER_BUSY", message: "Busy." });
      });
      expect(screen.getByText("The game server is busy. Try again in a minute.")).toBeTruthy();

      await user.click(screen.getByRole("button", { name: "Dismiss" }));

      expect(screen.queryByText("The game server is busy. Try again in a minute.")).toBeNull();
    });
  });
});
