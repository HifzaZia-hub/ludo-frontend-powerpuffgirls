import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FakeAdapter } from "@/adapter/FakeAdapter";
import { pieceCell, piecePlacement } from "@/config/geometry";
import type { EventType } from "@/contract/events";
import type { GameStateSnapshot, LegalMove } from "@/contract/types";
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
        renderLive({
          ...start,
          turn: {
            ...start.turn,
            phase: "AWAITING_MOVE",
            lastRoll: 6,
            legalMoves: [{ pieceId: "R1", fromStep: 0, toStep: 1, captures: [] }],
          },
        });

        expect(within(screen.getByRole("banner")).getByText("Your turn — pick a piece")).toBeTruthy();
      });

      // R6: never tell someone to pick when there is nothing to pick.
      it("says my turn is skipped when I can't move", () => {
        renderLive({ ...start, turn: { ...start.turn, phase: "AWAITING_MOVE", lastRoll: 3 } });

        expect(screen.getByText("Rida can't move. Turn skipped.")).toBeTruthy();
        expect(screen.queryByText("Your turn — pick a piece")).toBeNull();
      });

      it("says who else can't move", () => {
        renderLive({
          ...start,
          turn: { ...start.turn, activePlayerId: "p2", phase: "AWAITING_MOVE", lastRoll: 3 },
        });

        expect(screen.getByText("Hamza can't move. Turn skipped.")).toBeTruthy();
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

  describe("moving", () => {
    // In the spread fixture Rida's pieces are on 0, 7, 30 and 54, and Hamza's third is on 14.
    const R2_MOVE: LegalMove = { pieceId: "R2", fromStep: 7, toStep: 10, captures: ["G3"] };
    const R4_MOVE: LegalMove = { pieceId: "R4", fromStep: 54, toStep: 57, captures: [] };
    const R2_BUTTON = /^Red piece 2/;
    const R4_BUTTON = /^Red piece 4/;
    const R2_CARD = /^Piece 2/;
    const STEP_MS = 120;

    function choosing(legalMoves: LegalMove[] = [R2_MOVE, R4_MOVE]): GameStateSnapshot {
      const spread = fixture("spread");
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

    function moved(from: GameStateSnapshot, pieceId: string, step: number): GameStateSnapshot {
      return {
        ...from,
        version: from.version + 1,
        pieces: from.pieces.map((piece) => (piece.id === pieceId ? { ...piece, step } : piece)),
        turn: { ...from.turn, activePlayerId: "p2", phase: "AWAITING_ROLL", legalMoves: [] },
      };
    }

    const ACCEPTED = { ok: true, version: choosing().version + 1 } as const;

    function renderLive(snapshot: GameStateSnapshot = choosing()) {
      const adapter = new FakeAdapter();
      const store = createGameStore(adapter);
      store.getState().listen();
      store.getState().applySnapshot(snapshot);
      store.setState({ myPlayerId: FIXTURE_PLAYER_ID, connection: "live" });
      const { container } = render(<GameScreen store={store} />);
      return { adapter, container, store, user: userEvent.setup() };
    }

    function board(): HTMLElement {
      return screen.getByRole("region", { name: "Game board" });
    }

    function pieceButton(name: RegExp): HTMLElement {
      return within(board()).getByRole("button", { name });
    }

    function stateOf(container: HTMLElement, id: string): string | null | undefined {
      return container.querySelector(`[data-piece="${id}"] [data-state]`)?.getAttribute("data-state");
    }

    function positions(container: HTMLElement): Record<string, string> {
      const found = [...container.querySelectorAll<HTMLElement>("[data-piece]")];
      return Object.fromEntries(
        found.map((element) => [element.dataset.piece, `${element.style.left} ${element.style.top}`]),
      );
    }

    beforeEach(() => {
      useSettingsStore.setState({ animation: "off" });
    });

    // FR-SYS-03 POST-03-1
    it("offers exactly the server's pieces and dims every other piece", () => {
      const { container } = renderLive();

      const names = within(board())
        .getAllByRole("button")
        .map((button) => button.getAttribute("aria-label"));
      expect(names).toEqual([
        "Red piece 2, on the track, can move 3 squares and capture Hamza's piece",
        "Red piece 4, in the home column, can reach home",
      ]);
      expect(stateOf(container, "R1")).toBe("dimmed");
      expect(stateOf(container, "G1")).toBe("dimmed");
    });

    it("offers nothing on someone else's move", () => {
      const snapshot = choosing();
      renderLive({ ...snapshot, turn: { ...snapshot.turn, activePlayerId: "p2" } });

      expect(within(board()).queryAllByRole("button")).toHaveLength(0);
      expect(screen.queryByRole("region", { name: "Your moves" })).toBeNull();
    });

    // docs/03-ui-spec.md S5, R6
    it("never shows an empty chooser", () => {
      renderLive(choosing([]));

      expect(screen.queryByRole("region", { name: "Your moves" })).toBeNull();
      expect(within(board()).queryAllByRole("button")).toHaveLength(0);
    });

    it("shows no chooser when the server will play the only option", () => {
      const snapshot = choosing([R4_MOVE]);
      renderLive({ ...snapshot, rules: { ...snapshot.rules, autoMoveSingleOption: true } });

      expect(screen.queryByRole("region", { name: "Your moves" })).toBeNull();
      expect(screen.getByText("Your turn — moving your piece")).toBeTruthy();
    });

    // NFR-SYS-08: the turn doesn't change after a roll, so nothing else would be announced.
    it("tells a screen reader when to pick a piece", () => {
      const { container } = renderLive();

      expect(container.querySelector('p.sr-only[aria-live="polite"]')?.textContent).toBe(
        "Your turn — pick a piece",
      );
    });

    // Contract §4: the die lands on the value, then the moves are highlighted.
    it("holds the choice and the words back until the die has landed", async () => {
      useSettingsStore.setState({ animation: "on" });
      const start = fixture("start");
      const { adapter, user } = renderLive(start);
      adapter.queueAck({ ok: true, version: start.version + 1 });

      await user.click(screen.getByRole("button", { name: /dice/i }));
      await act(async () =>
        adapter.pushState({
          ...start,
          version: start.version + 1,
          turn: {
            ...start.turn,
            phase: "AWAITING_MOVE",
            lastRoll: 6,
            legalMoves: [{ pieceId: "R1", fromStep: 0, toStep: 1, captures: [] }],
          },
        }),
      );

      expect(screen.queryByRole("region", { name: "Your moves" })).toBeNull();
      expect(within(board()).queryByRole("button", { name: /^Red piece/ })).toBeNull();
      expect(screen.getByText("Your turn — roll the dice")).toBeTruthy();

      expect(await screen.findByRole("region", { name: "Your moves" })).toBeTruthy();
      expect(within(screen.getByRole("banner")).getByText("Your turn — pick a piece")).toBeTruthy();
    });

    it("lists the same moves as cards", () => {
      renderLive();

      const list = screen.getByRole("region", { name: "Your moves" });
      expect(within(list).getByRole("button", { name: /Piece 4 → reach home/ })).toBeTruthy();
    });

    describe("by mouse", () => {
      // A press focuses the button first. If that chose the piece, the click would send it.
      it("sends nothing on the first click", async () => {
        const { adapter, container, user } = renderLive();

        await user.click(pieceButton(R2_BUTTON));

        expect(adapter.commands).toEqual([]);
        expect(stateOf(container, "R2")).toBe("selected");
      });

      // FR-18
      it("previews the destination and the capture before anything is sent", async () => {
        const { container, user } = renderLive();

        await user.click(pieceButton(R2_BUTTON));

        expect(container.querySelector("[data-destination]")).not.toBeNull();
        expect(stateOf(container, "G3")).toBe("target");
      });

      it("sends on a second click", async () => {
        const { adapter, user } = renderLive();
        const release = adapter.holdNextAck();

        await user.click(pieceButton(R2_BUTTON));
        await user.click(pieceButton(R2_BUTTON));

        expect(adapter.commands).toEqual([{ name: "move", pieceId: "R2" }]);
        await act(async () => release({ ok: false, error: { code: "SERVER_BUSY", message: "" } }));
      });

      it("sends with the Move button", async () => {
        const { adapter, user } = renderLive();
        const release = adapter.holdNextAck();

        await user.click(pieceButton(R4_BUTTON));
        await user.click(screen.getByRole("button", { name: "Move" }));

        expect(adapter.commands).toEqual([{ name: "move", pieceId: "R4" }]);
        await act(async () => release({ ok: false, error: { code: "SERVER_BUSY", message: "" } }));
      });

      it("works from the cards as well", async () => {
        const { adapter, container, user } = renderLive();
        const card = screen.getByRole("button", { name: R2_CARD });
        const release = adapter.holdNextAck();

        await user.click(card);
        expect(stateOf(container, "R2")).toBe("selected");
        expect(adapter.commands).toEqual([]);

        await user.click(card);
        expect(adapter.commands).toEqual([{ name: "move", pieceId: "R2" }]);
        await act(async () => release({ ok: false, error: { code: "SERVER_BUSY", message: "" } }));
      });
    });

    // NFR-SYS-08
    describe("by keyboard", () => {
      it("picks with a number and confirms with Enter", async () => {
        const { adapter, container, user } = renderLive();
        const release = adapter.holdNextAck();

        await user.keyboard("4");
        expect(stateOf(container, "R4")).toBe("selected");
        expect(document.activeElement).toBe(pieceButton(R4_BUTTON));
        expect(adapter.commands).toEqual([]);

        await user.keyboard("{Enter}");
        expect(adapter.commands).toEqual([{ name: "move", pieceId: "R4" }]);
        await act(async () => release({ ok: false, error: { code: "SERVER_BUSY", message: "" } }));
      });

      it("ignores the number of a piece that can't move", async () => {
        const { container, user } = renderLive();

        await user.keyboard("1");

        expect(stateOf(container, "R1")).toBe("dimmed");
      });

      it("picks by tabbing to a piece and sends only once on Enter", async () => {
        const { adapter, container, user } = renderLive();
        const release = adapter.holdNextAck();
        act(() => pieceButton(R2_BUTTON).focus());
        await user.tab();

        expect(document.activeElement).toBe(pieceButton(R4_BUTTON));
        expect(stateOf(container, "R4")).toBe("selected");
        expect(adapter.commands).toEqual([]);

        await user.keyboard("{Enter}");

        expect(adapter.commands).toEqual([{ name: "move", pieceId: "R4" }]);
        await act(async () => release({ ok: false, error: { code: "SERVER_BUSY", message: "" } }));
      });

      it("cancels with Escape", async () => {
        const { container, user } = renderLive();
        await user.keyboard("2");

        await user.keyboard("{Escape}");

        expect(stateOf(container, "R2")).toBe("movable");
        expect(container.querySelector("[data-destination]")).toBeNull();
      });

      it("puts the keyboard on the die when its piece stops being a button", async () => {
        const { adapter, user } = renderLive();
        adapter.queueAck(ACCEPTED);
        await user.keyboard("2");
        await user.keyboard("{Enter}");

        await act(async () => adapter.pushState(moved(choosing(), "R2", 10)));
        await waitFor(() =>
          expect(document.activeElement).toBe(screen.getByRole("button", { name: /dice/i })),
        );
      });
    });

    describe("sending", () => {
      // NFR-SYS-01, EXC-02-1
      it("locks every control at once while the move is on its way", async () => {
        const { adapter, user } = renderLive();
        const release = adapter.holdNextAck();
        await user.click(pieceButton(R2_BUTTON));

        await user.click(pieceButton(R2_BUTTON));

        expect(pieceButton(R4_BUTTON).getAttribute("aria-disabled")).toBe("true");
        expect(screen.getByRole("button", { name: "Move" }).getAttribute("aria-busy")).toBe("true");
        await user.click(pieceButton(R4_BUTTON));
        await user.click(pieceButton(R4_BUTTON));
        expect(adapter.commands).toHaveLength(1);
        await act(async () => release({ ok: false, error: { code: "SERVER_BUSY", message: "" } }));
      });

      // FR-SYS-03 EXC-03-2
      it("doesn't move anything until the new snapshot arrives", async () => {
        const { adapter, container, user } = renderLive();
        adapter.queueAck(ACCEPTED);
        const before = positions(container);

        await user.click(pieceButton(R2_BUTTON));
        await user.click(pieceButton(R2_BUTTON));
        await act(async () => Promise.resolve());
        expect(positions(container)).toEqual(before);

        await act(async () => adapter.pushState(moved(choosing(), "R2", 10)));
        expect(positions(container)).not.toEqual(before);
      });

      // FR-SYS-04 POST-04-1
      it("explains an illegal move, drops the choice and keeps the board", async () => {
        const { adapter, container, store, user } = renderLive();
        const before = store.getState().snapshot;
        const placed = positions(container);
        adapter.queueAck({
          ok: false,
          error: { code: "ILLEGAL_MOVE", message: "That piece can't move that far." },
        });

        await user.click(pieceButton(R2_BUTTON));
        await user.click(pieceButton(R2_BUTTON));

        await waitFor(() => expect(stateOf(container, "R2")).toBe("movable"));
        expect(store.getState().toasts[0]?.message).toBe("That piece can't move that far.");
        expect(store.getState().snapshot).toBe(before);
        expect(positions(container)).toEqual(placed);
        expect(container.querySelector("[data-destination]")).toBeNull();
      });

      // FR-SYS-04 ALT-04-1
      it("has friendly words when the server gives no reason", async () => {
        const { adapter, container, store, user } = renderLive();
        adapter.queueAck({ ok: false, error: { code: "ILLEGAL_MOVE", message: "" } });

        await user.click(pieceButton(R2_BUTTON));
        await user.click(pieceButton(R2_BUTTON));

        await waitFor(() => expect(stateOf(container, "R2")).toBe("movable"));
        expect(store.getState().toasts[0]?.message).toBe("That didn't work. Try again.");
      });

      // FR-SYS-03 EXC-03-1
      it("refreshes the options when the piece is no longer legal", async () => {
        const { adapter, container, store, user } = renderLive();
        adapter.queueAck({ ok: false, error: { code: "PIECE_NOT_FOUND", message: "Gone." } });

        await user.click(pieceButton(R2_BUTTON));
        await user.click(pieceButton(R2_BUTTON));

        await waitFor(() => expect(stateOf(container, "R2")).toBe("movable"));
        expect(store.getState().toasts).toHaveLength(1);
        expect(adapter.commands).toContainEqual({
          name: "sync",
          knownVersion: choosing().version,
        });
      });

      // FR-SYS-04 EXC-04-1: pressing again is the retry, and the game hasn't changed.
      it("can be retried after a failure", async () => {
        const { adapter, container, user } = renderLive();
        adapter.queueAck({ ok: false, error: { code: "INTERNAL_ERROR", message: "" } });
        await user.click(pieceButton(R2_BUTTON));
        await user.click(pieceButton(R2_BUTTON));
        await waitFor(() => expect(stateOf(container, "R2")).toBe("movable"));
        const release = adapter.holdNextAck();

        await user.click(pieceButton(R2_BUTTON));
        await user.click(pieceButton(R2_BUTTON));

        expect(adapter.commands.filter(({ name }) => name === "move")).toHaveLength(2);
        await act(async () => release({ ok: false, error: { code: "SERVER_BUSY", message: "" } }));
      });
    });

    describe("walking", () => {
      beforeEach(() => {
        vi.useFakeTimers();
        useSettingsStore.setState({ animation: "on" });
      });
      afterEach(() => {
        vi.useRealTimers();
      });

      function advance(ms: number) {
        act(() => {
          vi.advanceTimersByTime(ms);
        });
      }

      function placementAt(step: number): { left: number; top: number } {
        const piece = choosing().pieces.find(({ id }) => id === "R2");
        if (!piece) throw new Error("R2 is in the fixture");
        return piecePlacement(pieceCell({ ...piece, step }), { dx: 0, dy: 0, scale: 1 });
      }

      function leftOf(container: HTMLElement, id: string): number {
        const element = container.querySelector<HTMLElement>(`[data-piece="${id}"]`);
        return parseFloat(element?.style.left ?? "");
      }

      it("walks through the squares between the two snapshots", () => {
        const { adapter, container } = renderLive();

        act(() => adapter.pushState(moved(choosing(), "R2", 10)));
        expect(leftOf(container, "R2")).toBeCloseTo(placementAt(8).left);

        advance(STEP_MS);
        expect(leftOf(container, "R2")).toBeCloseTo(placementAt(9).left);
      });

      it("offers Skip only during a walk, and Skip finishes it", async () => {
        const { adapter, container } = renderLive();
        expect(screen.queryByRole("button", { name: "Skip" })).toBeNull();

        act(() => adapter.pushState(moved(choosing(), "R2", 10)));
        const skip = screen.getByRole("button", { name: "Skip" });

        act(() => skip.click());

        expect(leftOf(container, "R2")).toBeCloseTo(placementAt(10).left);
        expect(screen.queryByRole("button", { name: "Skip" })).toBeNull();
      });

      it("skips with the S key", () => {
        const { adapter, container } = renderLive();
        act(() => adapter.pushState(moved(choosing(), "R2", 10)));

        act(() => {
          window.dispatchEvent(new KeyboardEvent("keydown", { key: "s" }));
        });

        expect(leftOf(container, "R2")).toBeCloseTo(placementAt(10).left);
      });

      // POST-05-1: the snapshot always wins when it moves a piece.
      it("ends where the snapshot says when another piece moves", () => {
        const { adapter, container } = renderLive();
        const afterMove = moved(choosing(), "R2", 13);
        act(() => adapter.pushState(afterMove));
        advance(STEP_MS);
        expect(leftOf(container, "R2")).not.toBeCloseTo(placementAt(13).left);

        act(() => adapter.pushState(moved(afterMove, "G3", 15)));

        expect(leftOf(container, "R2")).toBeCloseTo(placementAt(13).left);
      });

      it("keeps walking when the next snapshot moves no piece", () => {
        const { adapter, container } = renderLive();
        const afterMove = moved(choosing(), "R2", 13);
        act(() => adapter.pushState(afterMove));
        advance(STEP_MS);

        act(() => adapter.pushState({ ...afterMove, version: afterMove.version + 1 }));

        expect(leftOf(container, "R2")).toBeCloseTo(placementAt(9).left);
      });

      // POST-05-2
      it("ends on exactly the same board with animations on or off", () => {
        const on = renderLive();
        act(() => on.adapter.pushState(moved(choosing(), "R2", 13)));
        // One hop at a time, because each hop is only timed once the last one has been drawn.
        for (let hop = 0; hop < 6; hop++) advance(STEP_MS);
        const finishedOn = positions(on.container);
        on.container.remove();
        cleanup();

        useSettingsStore.setState({ animation: "off" });
        const off = renderLive();
        act(() => off.adapter.pushState(moved(choosing(), "R2", 13)));

        expect(positions(off.container)).toEqual(finishedOn);
        expect(screen.queryByRole("button", { name: "Skip" })).toBeNull();
      });
    });
  });

  // FR-SYS-05, D2 FR-23, D2 FR-36
  describe("event feedback", () => {
    const FLASH_MS = 150;
    const RETURN_MS = 400;
    const STEP_MS = 120;

    function start(): GameStateSnapshot {
      const spread = fixture("spread");
      return { ...spread, turn: { ...spread.turn, activePlayerId: FIXTURE_PLAYER_ID, lastRoll: 3 } };
    }

    function changed(from: GameStateSnapshot, steps: Record<string, number>): GameStateSnapshot {
      return {
        ...from,
        version: from.version + 1,
        pieces: from.pieces.map((piece) => {
          const step = steps[piece.id];
          return step === undefined ? piece : { ...piece, step };
        }),
      };
    }

    function send(adapter: FakeAdapter, snapshot: GameStateSnapshot, ...types: EventType[]) {
      act(() => {
        for (const type of types) {
          adapter.pushEvent({ v: "1.0.0", version: snapshot.version, type, data: {} });
        }
        adapter.pushState(snapshot);
      });
    }

    function renderLive(snapshot: GameStateSnapshot = start()) {
      const adapter = new FakeAdapter();
      const store = createGameStore(adapter);
      store.getState().listen();
      store.getState().applySnapshot(snapshot);
      store.setState({ myPlayerId: FIXTURE_PLAYER_ID, connection: "live" });
      const { container } = render(<GameScreen store={store} />);
      return { adapter, container, store };
    }

    function logLines(): string[] {
      const log = screen.getByRole("region", { name: "Messages" });
      return [...log.querySelectorAll("p, li")].map((line) => line.textContent ?? "");
    }

    function leftOf(container: HTMLElement, id: string): number {
      const element = container.querySelector<HTMLElement>(`[data-piece="${id}"]`);
      return parseFloat(element?.style.left ?? "");
    }

    function leftAt(id: string, step: number): number {
      const piece = start().pieces.find((candidate) => candidate.id === id);
      if (!piece) throw new Error(`${id} is in the fixture`);
      return piecePlacement(pieceCell({ ...piece, step }), { dx: 0, dy: 0, scale: 1 }).left;
    }

    beforeEach(() => {
      vi.useFakeTimers();
      useSettingsStore.setState({ animation: "on", sound: false });
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    function advance(ms: number) {
      act(() => {
        vi.advanceTimersByTime(ms);
      });
    }

    // Each hop is only timed once the last one has been drawn.
    function walk(hops: number) {
      for (let hop = 0; hop < hops; hop++) advance(STEP_MS);
    }

    it("plays a capture in order: the walk, the flash, the return, then the extra turn", () => {
      const { adapter, container } = renderLive();
      const moved = changed(start(), { R2: 10, G3: 0 });

      send(adapter, moved, "MOVED", "CAPTURED", "BONUS_TURN");

      // The captured piece waits on its square while the other walks up to it.
      expect(leftOf(container, "G3")).toBeCloseTo(leftAt("G3", 14));
      expect(container.querySelector("[data-effect]")).toBeNull();
      expect(container.querySelector("[data-banner]")).toBeNull();

      walk(3);
      expect(container.querySelector('[data-piece="G3"] [data-effect="capture"]')).not.toBeNull();
      expect(leftOf(container, "G3")).toBeCloseTo(leftAt("G3", 14));

      advance(FLASH_MS);
      expect(container.querySelector("[data-effect]")).toBeNull();
      expect(container.querySelector("[data-banner]")).toBeNull();
      // On its way back to its base slot, which is where the snapshot says it is.
      expect(leftOf(container, "G3")).toBeCloseTo(leftAt("G3", 0));

      advance(RETURN_MS);
      expect(container.querySelector("[data-banner]")?.textContent).toBe("Roll again!");
    });

    // Contract §4 and §6: a roll and the move it led to read as one line.
    it("reads like a story of the game", () => {
      const { adapter } = renderLive();
      const rolled = changed(start(), {});
      send(adapter, rolled, "ROLLED");
      expect(logLines()).toEqual(["Rida rolled 3."]);

      const moved = changed(rolled, { R2: 10, G3: 0 });
      send(adapter, moved, "MOVED", "CAPTURED", "BONUS_TURN");
      walk(3);
      advance(FLASH_MS);
      advance(RETURN_MS);

      expect(logLines()).toEqual(["Rida rolls again!", "Rida rolled 3 and captured Hamza's piece!"]);
    });

    // POST-05-2, POST-10-2: the done-when for this task.
    it("ends on the same board and the same words with animation and sound off", () => {
      function play() {
        const view = renderLive();
        const rolled = changed(start(), {});
        send(view.adapter, rolled, "ROLLED");
        send(view.adapter, changed(rolled, { R2: 10, G3: 0 }), "MOVED", "CAPTURED", "BONUS_TURN");
        return view;
      }
      const positions = (container: HTMLElement) =>
        [...container.querySelectorAll<HTMLElement>("[data-piece]")].map(
          (element) => `${element.dataset.piece}:${element.style.left}:${element.style.top}`,
        );

      useSettingsStore.setState({ animation: "on", sound: true });
      const on = play();
      walk(3);
      advance(FLASH_MS);
      advance(RETURN_MS);
      const boardOn = positions(on.container);
      const wordsOn = logLines();
      cleanup();

      useSettingsStore.setState({ animation: "off", sound: false });
      const off = play();

      expect(positions(off.container)).toEqual(boardOn);
      expect(logLines()).toEqual(wordsOn);
    });

    // EXC-05-1
    it("shows nothing when the server sent no event, even if a piece went back", () => {
      const { adapter, container } = renderLive();

      send(adapter, changed(start(), { G3: 0 }));

      expect(container.querySelector("[data-effect]")).toBeNull();
      expect(logLines()).toEqual(["Moves will show up here."]);
    });

    it("offers Skip during the capture, and Skip finishes it with the words kept", () => {
      const { adapter, container } = renderLive();
      send(adapter, changed(start(), { R2: 10, G3: 0 }), "MOVED", "CAPTURED", "BONUS_TURN");
      walk(3);
      expect(container.querySelector('[data-effect="capture"]')).not.toBeNull();

      act(() => screen.getByRole("button", { name: "Skip" }).click());

      expect(container.querySelector("[data-effect]")).toBeNull();
      expect(leftOf(container, "G3")).toBeCloseTo(leftAt("G3", 0));
      expect(screen.queryByRole("button", { name: "Skip" })).toBeNull();
      expect(logLines()).toEqual([
        "Rida rolls again!",
        "Rida captured Hamza's piece!",
        "Rida moved a piece 3 squares.",
      ]);
    });

    it("glows a finishing piece and bumps the Home count", () => {
      const { adapter, container } = renderLive();
      send(adapter, changed(start(), { R4: 57 }), "MOVED", "PIECE_FINISHED");

      walk(3);

      expect(container.querySelector('[data-piece="R4"] [data-effect="finish"]')).not.toBeNull();
      expect(container.querySelector(".animate-bump")?.textContent).toBe("1");
    });

    it("flashes the sixes pips when a turn is forfeited", () => {
      const { adapter, container } = renderLive();

      send(adapter, changed(start(), {}), "ROLLED", "TURN_FORFEITED", "TURN_CHANGED");

      expect(container.querySelector("[data-sixes-flash]")).not.toBeNull();
    });

    it("shows a banner when a turn is skipped", () => {
      const { adapter, container } = renderLive();

      send(adapter, changed(start(), {}), "TURN_PASSED", "TURN_CHANGED");

      expect(container.querySelector("[data-banner]")?.textContent).toBe(
        "No move possible — turn skipped",
      );
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
