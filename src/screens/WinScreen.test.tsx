import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import confetti from "canvas-confetti";
import { FakeAdapter } from "@/adapter/FakeAdapter";
import type { GameStateSnapshot, RoomSnapshot } from "@/contract/types";
import { FIXTURE_PLAYER_ID, FIXTURES } from "@/mock/fixtures";
import { WinScreen } from "@/screens/WinScreen";
import { createGameStore } from "@/store/gameStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useUiStore } from "@/store/uiStore";

const COOLDOWN_MS = 5000;
const SEED = "abc"; // SHA-256 of this is a published test vector
const SEED_HASH = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";

// Rida is p1, Hamza p2, Maryam p3 and Computer 1 is p4.
function finished(changes: Partial<GameStateSnapshot> = {}): GameStateSnapshot {
  const spread = FIXTURES.spread;
  if (!spread) throw new Error("the spread fixture exists");
  return {
    ...spread,
    status: "FINISHED",
    winnerId: "p2",
    ranking: ["p2", "p4", "p1", "p3"],
    seedHash: SEED_HASH,
    seed: SEED,
    ...changes,
  };
}

function roomFor(snapshot: GameStateSnapshot, hostId: string): RoomSnapshot {
  return {
    v: snapshot.v,
    roomCode: snapshot.roomCode,
    status: snapshot.status,
    mode: "HUMAN_VS_HUMAN",
    rules: snapshot.rules,
    hostId,
    seats: snapshot.players.map((player, seat) => ({ seat, colour: player.colour, player })),
  };
}

function setup({ snapshot = finished(), hostId = FIXTURE_PLAYER_ID } = {}) {
  const adapter = new FakeAdapter();
  const store = createGameStore(adapter);
  store.setState({ myPlayerId: FIXTURE_PLAYER_ID, room: roomFor(snapshot, hostId) });
  store.getState().applySnapshot(snapshot);
  render(<WinScreen store={store} />);
  return { adapter, store, user: userEvent.setup() };
}

const playAgain = () => screen.getByRole<HTMLButtonElement>("button", { name: "Play again" });

describe("WinScreen", () => {
  beforeEach(() => {
    useUiStore.setState({ screen: "win", modal: null });
    useSettingsStore.setState({ animation: "on" });
    vi.mocked(confetti).mockClear();
  });

  // FR-SYS-06 EXC-06-1
  it("names the winner the server gave", () => {
    setup();

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Hamza wins!");
  });

  it("says the game is over if the server named nobody, rather than guessing", () => {
    setup({ snapshot: finished({ winnerId: undefined }) });

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("The game is over");
  });

  describe("ranking", () => {
    const places = () => screen.getByRole("region", { name: "Final places" });

    // POST-06-3: in the server's order, which is not the order of the players list.
    it("lists the others in the server's own order", () => {
      setup();

      expect(
        within(places())
          .getAllByRole("listitem")
          .map((item) => item.textContent?.replace(/^[A-Z]/, "")),
      ).toEqual(["2. Computer 1", "3. Rida", "4. Maryam"]);
    });

    it("uses the place the server gave, even if the winner isn't first", () => {
      setup({ snapshot: finished({ ranking: ["p1", "p2", "p3"] }) });

      expect(within(places()).getAllByRole("listitem")[0]?.textContent).toContain("1. Rida");
    });

    // ALT-06-1
    it("shows just the winner when the server sends no ranking", () => {
      setup({ snapshot: finished({ ranking: undefined }) });

      expect(screen.queryByRole("region", { name: "Final places" })).toBeNull();
      expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Hamza wins!");
    });
  });

  // D2 FR-29
  it("shows each player's wins this session, counted from the server's result", () => {
    setup();
    const score = screen.getByRole("region", { name: "Wins this session" });

    expect(within(score).getByText("Hamza").nextSibling?.textContent).toBe("1 win");
    expect(within(score).getByText("Rida").nextSibling?.textContent).toBe("0 wins");
  });

  describe("confetti", () => {
    it("celebrates once", () => {
      setup();

      expect(confetti).toHaveBeenCalledTimes(1);
    });

    it("stays away with animations off", () => {
      useSettingsStore.setState({ animation: "off" });
      setup();

      expect(confetti).not.toHaveBeenCalled();
    });
  });

  describe("playing again", () => {
    it("is for the host, and asks the server", async () => {
      const { adapter, user } = setup();

      await user.click(playAgain());

      expect(adapter.commands).toEqual([{ name: "restart" }]);
    });

    it("tells everyone else who they are waiting for", () => {
      setup({ hostId: "p2" });

      expect(screen.queryByRole("button", { name: "Play again" })).toBeNull();
      expect(screen.getByRole("status").textContent).toBe(
        "Waiting for Hamza to start a new game.",
      );
    });

    // FR-SYS-08 POST-08-3
    it("keeps the result and explains if the server refuses", async () => {
      const { adapter, store, user } = setup();
      const before = store.getState().snapshot;
      adapter.queueAck({ ok: false, error: { code: "SERVER_BUSY", message: "" } });

      await user.click(playAgain());

      await waitFor(() => expect(store.getState().toasts).toHaveLength(1));
      expect(store.getState().snapshot).toBe(before);
      expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Hamza wins!");
    });

    describe("after a press", () => {
      beforeEach(() => {
        vi.useFakeTimers();
      });
      afterEach(() => {
        vi.useRealTimers();
      });

      async function advance(ms: number) {
        await act(async () => {
          await vi.advanceTimersByTimeAsync(ms);
        });
      }

      it("rests for 5 seconds, because the server limits restarts", async () => {
        setup();

        fireEvent.click(playAgain());
        await advance(COOLDOWN_MS - 1);
        expect(playAgain().disabled).toBe(true);

        await advance(1);
        expect(playAgain().disabled).toBe(false);
      });

      it("sends one request for several presses", async () => {
        const { adapter } = setup();

        fireEvent.click(playAgain());
        fireEvent.click(playAgain());
        await advance(0);

        expect(adapter.commands).toEqual([{ name: "restart" }]);
      });
    });
  });

  describe("leaving", () => {
    it("New game leaves the room and opens setup", async () => {
      const { adapter, store, user } = setup();

      await user.click(screen.getByRole("button", { name: "New game" }));

      await waitFor(() => expect(useUiStore.getState().screen).toBe("setup"));
      expect(adapter.commands).toEqual([{ name: "leave" }]);
      expect(store.getState().room).toBeNull();
    });

    it("Main menu leaves the room", async () => {
      const { adapter, store, user } = setup();

      await user.click(screen.getByRole("button", { name: "Main menu" }));

      await waitFor(() => expect(store.getState().room).toBeNull());
      expect(adapter.commands).toEqual([{ name: "leave" }]);
    });

    // FR-SYS-08 POST-08-3
    it("stays put if leaving fails", async () => {
      const { adapter, store, user } = setup();
      adapter.queueAck({ ok: false, error: { code: "SERVER_BUSY", message: "" } });

      await user.click(screen.getByRole("button", { name: "New game" }));

      await waitFor(() => expect(store.getState().toasts).toHaveLength(1));
      expect(useUiStore.getState().screen).toBe("win");
      expect(store.getState().room).not.toBeNull();
    });
  });

  describe("checking the dice", () => {
    const check = () => screen.getByRole("button", { name: "Check the dice were fair" });

    it("waits until asked", () => {
      setup();

      expect(check()).toBeTruthy();
      expect(screen.queryByText(SEED)).toBeNull();
    });

    it("says so when the seed makes the published code", async () => {
      const { user } = setup();

      await user.click(check());

      expect(await screen.findByText(/They match/)).toBeTruthy();
      expect(screen.getByText(SEED_HASH)).toBeTruthy();
    });

    // The contract doesn't say how the code is made, so a mismatch proves nothing.
    it("never calls a game unfair when the codes differ", async () => {
      const { user } = setup({ snapshot: finished({ seed: "something else" }) });

      await user.click(check());

      expect(await screen.findByText("We couldn't check this game's dice.")).toBeTruthy();
      expect(screen.queryByText(/unfair|cheat/i)).toBeNull();
    });

    it("isn't offered without a seed from the server", () => {
      setup({ snapshot: finished({ seed: undefined }) });

      expect(screen.queryByRole("button", { name: "Check the dice were fair" })).toBeNull();
    });
  });
});
