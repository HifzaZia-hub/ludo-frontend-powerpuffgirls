import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FakeAdapter } from "@/adapter/FakeAdapter";
import type { GameStateSnapshot } from "@/contract/types";
import { FIXTURE_PLAYER_ID, FIXTURES } from "@/mock/fixtures";
import { GameScreen } from "@/screens/GameScreen";
import { createGameStore } from "@/store/gameStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useUiStore } from "@/store/uiStore";

function fixture(name: string): GameStateSnapshot {
  const snapshot = FIXTURES[name];
  if (!snapshot) throw new Error(`No fixture called ${name}`);
  return snapshot;
}

function renderGame(snapshot: GameStateSnapshot | null) {
  const store = createGameStore(new FakeAdapter());
  store.setState({ myPlayerId: FIXTURE_PLAYER_ID });
  if (snapshot) store.getState().applySnapshot(snapshot);
  const { container } = render(<GameScreen store={store} />);
  return { container, store, user: userEvent.setup() };
}

// The active player's name is in the top bar too, so look only inside the panel.
function nameInPanel(name: string): HTMLElement {
  return within(screen.getByRole("region", { name: "Players" })).getByText(name);
}

function countsOf(name: string): string[] {
  const card = nameInPanel(name).closest("li");
  if (!card) throw new Error(`No card for ${name}`);
  return within(card)
    .getAllByRole("definition")
    .map((count) => count.textContent ?? "");
}

describe("GameScreen", () => {
  beforeEach(() => {
    useUiStore.setState({ screen: "game", modal: null });
    useSettingsStore.setState({ theme: "dark", sound: true, animation: "on" });
  });
  afterEach(() => vi.restoreAllMocks());

  // Contract §4: GAME_STARTED arrives before the first game:state.
  it("waits politely for the first snapshot", () => {
    renderGame(null);

    expect(screen.getByRole("status").textContent).toBe("Getting the board ready…");
    expect(screen.getByRole("heading", { level: 1 })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Game board" })).toBeNull();
  });

  // FR-SYS-09
  it("has every part of the game on the one screen", () => {
    renderGame(fixture("spread"));

    expect(screen.getByRole("region", { name: "Game board" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "Players" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "Messages" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /dice/i })).toBeTruthy();
    expect(screen.getByText("Turn:")).toBeTruthy();
  });

  // FR-SYS-06: the numbers are written out here so the test doesn't repeat the code it checks.
  it.each<[string, Record<string, string[]>]>([
    [
      "start",
      {
        Rida: ["4", "0", "0"],
        Hamza: ["4", "0", "0"],
        Maryam: ["4", "0", "0"],
        "Computer 1": ["4", "0", "0"],
      },
    ],
    [
      "spread",
      {
        Rida: ["1", "3", "0"],
        Hamza: ["2", "1", "1"],
        Maryam: ["0", "3", "1"],
        "Computer 1": ["1", "1", "2"],
      },
    ],
    [
      "stacked",
      {
        Rida: ["0", "4", "0"],
        Hamza: ["0", "4", "0"],
        Maryam: ["2", "2", "0"],
        "Computer 1": ["2", "2", "0"],
      },
    ],
    [
      "homeRun",
      {
        Rida: ["0", "2", "2"],
        Hamza: ["0", "3", "1"],
        Maryam: ["1", "2", "1"],
        "Computer 1": ["0", "1", "3"],
      },
    ],
    [
      "edges",
      {
        Rida: ["2", "2", "0"],
        Hamza: ["2", "2", "0"],
        Maryam: ["2", "2", "0"],
        "Computer 1": ["2", "2", "0"],
      },
    ],
    ["twoPlayer", { Rida: ["2", "1", "1"], Maryam: ["3", "1", "0"] }],
  ])("shows the right counts and every piece for %s", (name, expected) => {
    const snapshot = fixture(name);
    const { container } = renderGame(snapshot);

    for (const [player, counts] of Object.entries(expected)) {
      expect(countsOf(player)).toEqual(counts);
    }
    expect(container.querySelectorAll("[data-piece]")).toHaveLength(snapshot.pieces.length);
  });

  it("names the active player in words and marks only their card", () => {
    const { container } = renderGame(fixture("spread"));

    const turnLine = screen.getByText("Turn:").parentElement;
    expect(turnLine?.textContent).toContain("Hamza");
    expect(turnLine?.textContent).not.toContain("(you)");
    const active = container.querySelectorAll('[aria-current="true"]');
    expect(active).toHaveLength(1);
    expect(active[0]?.textContent).toContain("Hamza");
  });

  it("says when the turn is yours", () => {
    renderGame(fixture("start"));

    expect(screen.getByText("Turn:").parentElement?.textContent).toContain("(you)");
  });

  it("doesn't claim anyone's turn once the match isn't running", () => {
    renderGame({ ...fixture("spread"), status: "FINISHED" });

    expect(screen.queryByText("Turn:")).toBeNull();
  });

  it("tags you, computers and players who dropped out", () => {
    renderGame(fixture("spread"));

    const tagOf = (name: string) => nameInPanel(name).nextElementSibling?.textContent;
    expect(tagOf("Rida")).toBe("you");
    expect(tagOf("Computer 1")).toBe("Computer");
    expect(tagOf("Maryam")).toBe("Offline — computer playing");
    expect(tagOf("Hamza")).toBeUndefined();
  });

  // NFR-SYS-05: it shows the server's roll and offers nothing to press until P7.
  it("shows the server's last roll on a die that can't be pressed yet", () => {
    renderGame(fixture("spread"));

    const dice = screen.getByRole<HTMLButtonElement>("button", { name: /dice shows 4/i });
    expect(dice.disabled).toBe(true);
  });

  // Read-only this task: rolling and moving arrive in P7 and P8.
  it("sends nothing to the server and offers no piece to press", () => {
    const adapter = new FakeAdapter();
    const store = createGameStore(adapter);
    store.getState().applySnapshot(fixture("spread"));
    render(<GameScreen store={store} />);

    expect(screen.queryByRole("button", { name: /piece/i })).toBeNull();
    expect(adapter.commands).toEqual([]);
  });

  // NFR-SYS-11
  it("draws the stars from this match's rules", () => {
    const snapshot = fixture("start");
    renderGame({ ...snapshot, rules: { ...snapshot.rules, safeSquares: [3, 4, 5] } });

    expect(screen.getAllByRole("img", { name: "Safe square" })).toHaveLength(3);
  });

  it("opens the rules and settings from the top bar", async () => {
    const { user } = renderGame(fixture("start"));

    await user.click(screen.getByRole("button", { name: "Rules" }));
    expect(useUiStore.getState().modal).toBe("rules");

    await user.click(screen.getByRole("button", { name: "Settings" }));
    expect(useUiStore.getState().modal).toBe("settings");
  });

  // FR-SYS-10 POST-10-2
  it("turns sound off without touching the game", async () => {
    const { store, user } = renderGame(fixture("start"));
    const { snapshot } = store.getState();

    await user.click(screen.getByRole("switch", { name: "Sound" }));

    expect(useSettingsStore.getState().sound).toBe(false);
    expect(store.getState().snapshot).toBe(snapshot);
  });

  it("keeps the same pieces on the page across snapshots", () => {
    const snapshot = fixture("start");
    const { container, store } = renderGame(snapshot);
    const before = container.querySelector('[data-piece="R1"]');

    act(() => {
      store.getState().applySnapshot({
        ...snapshot,
        version: snapshot.version + 1,
        pieces: snapshot.pieces.map((piece) =>
          piece.id === "R1" ? { ...piece, step: 1, boardSquare: 0 } : piece,
        ),
      });
    });

    expect(container.querySelector('[data-piece="R1"]')).toBe(before);
    expect(countsOf("Rida")).toEqual(["3", "1", "0"]);
  });

  describe("home count check", () => {
    it("stays quiet when the pieces and the server agree", () => {
      const errorLog = vi.spyOn(console, "error");

      renderGame(fixture("spread"));

      expect(errorLog).not.toHaveBeenCalled();
    });

    it("complains loudly when they disagree", () => {
      const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
      const snapshot = fixture("spread");

      renderGame({
        ...snapshot,
        players: snapshot.players.map((player) =>
          player.name === "Rida" ? { ...player, piecesHome: 3 } : player,
        ),
      });

      expect(errorLog).toHaveBeenCalledWith(expect.stringContaining("Home count mismatch for Rida"));
    });
  });
});
