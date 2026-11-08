import { act, render, screen, waitFor, within } from "@testing-library/react";
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
    expect(screen.getByText("Hamza's turn")).toBeTruthy();
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

    expect(screen.getByText("Hamza's turn")).toBeTruthy();
    const active = container.querySelectorAll('[aria-current="true"]');
    expect(active).toHaveLength(1);
    expect(active[0]?.textContent).toContain("Hamza");
  });

  it("says when the turn is yours", () => {
    renderGame(fixture("start"));

    expect(screen.getByText("Your turn — roll the dice")).toBeTruthy();
  });

  it("doesn't claim anyone's turn once the match isn't running", () => {
    renderGame({ ...fixture("spread"), status: "FINISHED" });

    expect(screen.queryByText("Hamza's turn")).toBeNull();
  });

  it("tags you, computers and players who dropped out", () => {
    renderGame(fixture("spread"));

    const tagOf = (name: string) => nameInPanel(name).nextElementSibling?.textContent;
    expect(tagOf("Rida")).toBe("you");
    expect(tagOf("Computer 1")).toBe("Computer");
    expect(tagOf("Maryam")).toBe("Offline — computer playing");
    expect(tagOf("Hamza")).toBeUndefined();
  });

  // NFR-SYS-05
  it("shows the server's last roll, even when it isn't my turn to press", () => {
    renderGame(fixture("spread"));

    const dice = screen.getByRole("button", { name: /dice shows 4/i });
    expect(dice.getAttribute("aria-disabled")).toBe("true");
  });

  // Moving a piece arrives in P8.
  it("sends nothing by itself and offers no piece to press", () => {
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

  describe("rolling", () => {
    const ACCEPTED = { ok: true, version: 2 } as const;

    function renderLive(snapshot: GameStateSnapshot) {
      const adapter = new FakeAdapter();
      const store = createGameStore(adapter);
      store.getState().listen();
      store.getState().applySnapshot(snapshot);
      store.setState({ myPlayerId: FIXTURE_PLAYER_ID, connection: "live" });
      const { container } = render(<GameScreen store={store} />);
      return { adapter, container, store, user: userEvent.setup() };
    }

    function die(): HTMLElement {
      return screen.getByRole("button", { name: /dice/i });
    }

    function rolled(lastRoll: number): GameStateSnapshot {
      const start = fixture("start");
      return {
        ...start,
        version: ACCEPTED.version,
        turn: { ...start.turn, phase: "AWAITING_MOVE", lastRoll },
      };
    }

    beforeEach(() => {
      useSettingsStore.setState({ animation: "off" });
    });

    it("can be pressed when all five conditions hold", () => {
      renderLive(fixture("start"));

      expect(die().hasAttribute("aria-disabled")).toBe(false);
    });

    // FR-SYS-02: each condition on its own is enough to stop a roll.
    describe("is disabled", () => {
      const start = fixture("start");

      it.each<[string, GameStateSnapshot]>([
        ["once the match isn't running", { ...start, status: "FINISHED" }],
        ["on someone else's turn", { ...start, turn: { ...start.turn, activePlayerId: "p2" } }],
        ["in the move phase", { ...start, turn: { ...start.turn, phase: "AWAITING_MOVE" } }],
      ])("%s", (_name, snapshot) => {
        renderLive(snapshot);

        expect(die().getAttribute("aria-disabled")).toBe("true");
      });

      it("while a command is pending", () => {
        const { store } = renderLive(start);

        act(() => store.setState({ pendingCommand: { id: 1, kind: "addAi", seat: 2 } }));

        expect(die().getAttribute("aria-disabled")).toBe("true");
      });

      it("while the connection isn't live", () => {
        const { store } = renderLive(start);

        act(() => store.setState({ connection: "reconnecting" }));

        expect(die().getAttribute("aria-disabled")).toBe("true");
      });
    });

    it("sends nothing when pressed on someone else's turn", async () => {
      const start = fixture("start");
      const { adapter, user } = renderLive({
        ...start,
        turn: { ...start.turn, activePlayerId: "p2" },
      });

      await user.click(die());

      expect(adapter.commands).toEqual([]);
    });

    // FR-SYS-02 EXC-02-1
    it("sends one roll for a double click", async () => {
      const { adapter, user } = renderLive(fixture("start"));
      const release = adapter.holdNextAck();

      await user.dblClick(die());

      expect(adapter.commands).toEqual([{ name: "roll" }]);
      await act(async () => release(ACCEPTED));
    });

    it("rolls with the R key", async () => {
      const { adapter, user } = renderLive(fixture("start"));
      const release = adapter.holdNextAck();

      await user.keyboard("r");

      expect(adapter.commands).toEqual([{ name: "roll" }]);
      await act(async () => release(ACCEPTED));
    });

    it("rolls with Space on the die", async () => {
      const { adapter, user } = renderLive(fixture("start"));
      const release = adapter.holdNextAck();
      die().focus();

      await user.keyboard(" ");

      expect(adapter.commands).toEqual([{ name: "roll" }]);
      await act(async () => release(ACCEPTED));
    });

    // NFR-SYS-01, POST-02-2, NFR-SYS-05
    it.each([6, 1, 3])("shows pending at once, then lands on the server's %i", async (value) => {
      const { adapter, container, user } = renderLive(fixture("start"));
      const release = adapter.holdNextAck();

      await user.click(die());
      expect(die().getAttribute("aria-busy")).toBe("true");
      expect(container.querySelectorAll("[data-pip]")).toHaveLength(0);

      act(() => adapter.pushState(rolled(value)));
      await act(async () => release(ACCEPTED));

      await screen.findByRole("button", { name: `The dice shows ${value}. Roll the dice` });
      expect(container.querySelectorAll("[data-pip]")).toHaveLength(value);
    });

    // FR-SYS-02 EXC-02-2
    it("keeps the game, explains, and lets me try again when a roll fails", async () => {
      const { adapter, store, user } = renderLive(fixture("start"));
      const before = store.getState().snapshot;
      adapter.queueAck({ ok: false, error: { code: "SERVER_BUSY", message: "Busy." } });

      await user.click(die());

      await waitFor(() => expect(die().hasAttribute("aria-busy")).toBe(false));
      expect(store.getState().snapshot).toBe(before);
      expect(store.getState().toasts[0]?.message).toBe(
        "The game server is busy. Try again in a minute.",
      );
      expect(die().hasAttribute("aria-disabled")).toBe(false);
    });

    describe("turn text", () => {
      const start = fixture("start");
      const onTurnOf = (activePlayerId: string): GameStateSnapshot => ({
        ...start,
        turn: { ...start.turn, activePlayerId },
      });

      it("tells me to pick a piece after I roll", () => {
        renderLive({ ...start, turn: { ...start.turn, phase: "AWAITING_MOVE", lastRoll: 6 } });

        expect(screen.getByText("Your turn — pick a piece")).toBeTruthy();
      });

      it("names another person", () => {
        const { container } = renderLive(onTurnOf("p2"));

        expect(screen.getByText("Hamza's turn")).toBeTruthy();
        expect(container.querySelector("[data-thinking]")).toBeNull();
      });

      // FR-SYS-07
      it("says a computer is thinking, with the dots", () => {
        const { container } = renderLive(onTurnOf("p4"));

        expect(screen.getByText("Computer is thinking…")).toBeTruthy();
        expect(container.querySelector("[data-thinking]")).not.toBeNull();
      });

      it("announces when it becomes my turn", () => {
        const { adapter, container } = renderLive(onTurnOf("p4"));
        const announcer = container.querySelector('p.sr-only[aria-live="polite"]');
        expect(announcer?.textContent).toBe("");

        act(() => adapter.pushState({ ...start, version: start.version + 1 }));

        expect(announcer?.textContent).toBe("Your turn");
      });
    });

    describe("sixes counter", () => {
      const start = fixture("start");

      it("fills one pip per six in a row", () => {
        const { container } = renderLive({ ...start, turn: { ...start.turn, sixesInRow: 2 } });

        expect(container.querySelectorAll('[data-six="filled"]')).toHaveLength(2);
        expect(container.querySelectorAll('[data-six="empty"]')).toHaveLength(1);
        expect(screen.getByRole("img", { name: "2 of 3 sixes in a row" })).toBeTruthy();
      });

      // NFR-SYS-11
      it("is hidden when the rules don't count sixes", () => {
        const { container } = renderLive({
          ...start,
          rules: { ...start.rules, threeSixesForfeit: false },
        });

        expect(container.querySelector("[data-six]")).toBeNull();
      });
    });

    describe("countdown", () => {
      const start = fixture("start");
      const withDeadline = (deadline: string, activePlayerId = FIXTURE_PLAYER_ID) => ({
        ...start,
        turn: { ...start.turn, deadline, activePlayerId },
      });
      const inTwentySeconds = () => new Date(Date.now() + 20_500).toISOString();
      const aMomentAgo = () => new Date(Date.now() - 1000).toISOString();
      const TIME_UP = "Time's up — the computer will play for you.";

      it("counts down from the server's deadline", () => {
        renderLive(withDeadline(inTwentySeconds()));

        expect(screen.getByRole("timer").getAttribute("aria-label")).toBe("20 seconds left");
        expect(screen.queryByText(TIME_UP)).toBeNull();
      });

      it("says time is up on my turn and sends nothing", () => {
        const { adapter } = renderLive(withDeadline(aMomentAgo()));

        expect(screen.getByText(TIME_UP)).toBeTruthy();
        expect(adapter.commands).toEqual([]);
      });

      it("doesn't say the computer will play for me on someone else's turn", () => {
        renderLive(withDeadline(aMomentAgo(), "p2"));

        expect(screen.queryByText(TIME_UP)).toBeNull();
      });

      // NFR-SYS-11
      it("is hidden when the rules have no timer", () => {
        renderLive({ ...start, rules: { ...start.rules, turnTimerSeconds: 0 } });

        expect(screen.queryByRole("timer")).toBeNull();
      });
    });
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
