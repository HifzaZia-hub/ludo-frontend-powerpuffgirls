import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FakeAdapter } from "@/adapter/FakeAdapter";
import type { RoomSnapshot } from "@/contract/types";
import { LobbyScreen } from "@/screens/LobbyScreen";
import { createGameStore } from "@/store/gameStore";
import { makePlayer, makeRoom } from "@/testRoom";

function renderLobby(myPlayerId = "p1", room: RoomSnapshot = makeRoom()) {
  const adapter = new FakeAdapter();
  const store = createGameStore(adapter);
  store.getState().listen();
  store.setState({ room, myPlayerId });
  render(<LobbyScreen store={store} />);
  return { adapter, store, user: userEvent.setup() };
}

const fullRoom = makeRoom({
  seats: makeRoom().seats.map((seat) => ({
    ...seat,
    player: seat.player ?? makePlayer(`p${seat.seat}`, `Computer ${seat.seat}`, { isAi: true }),
  })),
});

const addButtonFor = (colour: string) =>
  screen.getByRole("button", { name: `Add computer player as ${colour}` });
const startButton = () => screen.getByRole("button", { name: "Start game" });

describe("LobbyScreen", () => {
  it("shows the code and the seats from the server", () => {
    renderLobby();

    expect(screen.getByText("K7QX2M")).toBeTruthy();
    expect(screen.getByText("Rida")).toBeTruthy();
    expect(screen.getByText("(you)")).toBeTruthy();
    expect(screen.getByText("Host")).toBeTruthy();
    // NFR-SYS-07: every seat shows its mark, empty ones included.
    expect(screen.getAllByRole("img").map((mark) => mark.getAttribute("aria-label"))).toEqual([
      "Red",
      "Green",
      "Yellow",
      "Blue",
    ]);
  });

  it("marks computer players", () => {
    renderLobby("p1", fullRoom);
    expect(screen.getAllByText("Computer")).toHaveLength(3);
  });

  it("confirms a copy with the real code", async () => {
    const { user } = renderLobby();

    await user.click(screen.getByRole("button", { name: "Copy" }));

    expect(screen.getByRole("button", { name: "Copied!" })).toBeTruthy();
    expect(await navigator.clipboard.readText()).toBe("K7QX2M");
  });

  it("says so when the browser refuses to copy", async () => {
    const { user } = renderLobby();
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValueOnce(new Error("blocked"));

    await user.click(screen.getByRole("button", { name: "Copy" }));

    expect(screen.getByText("Couldn't copy. Tell your friends the code instead.")).toBeTruthy();
  });

  describe("as the host", () => {
    it("offers a computer player for each empty seat", () => {
      renderLobby();
      expect(addButtonFor("Green")).toBeTruthy();
      expect(addButtonFor("Yellow")).toBeTruthy();
      expect(addButtonFor("Blue")).toBeTruthy();
      expect(screen.queryByText("Waiting for a player…")).toBeNull();
    });

    // POST-07-2: the list changes only when the server says so.
    it("adds through the server and only redraws on room:updated", async () => {
      const { adapter, user } = renderLobby();

      await user.click(addButtonFor("Green"));

      expect(adapter.commands).toEqual([{ name: "addAi", seat: 2, difficulty: "NORMAL" }]);
      expect(screen.queryByText("Computer 2")).toBeNull();
      expect(addButtonFor("Green")).toBeTruthy();

      const computer = makePlayer("p9", "Computer 2", { isAi: true, colour: "GREEN" });
      act(() => {
        adapter.pushRoom(
          makeRoom({
            seats: makeRoom().seats.map((seat) =>
              seat.seat === 2 ? { ...seat, player: computer } : seat,
            ),
          }),
        );
      });

      expect(screen.getByText("Computer 2")).toBeTruthy();
    });

    // NFR-SYS-01
    it("shows the press at once and holds the other controls", async () => {
      const { adapter, user } = renderLobby();
      const release = adapter.holdNextAck();

      await user.click(addButtonFor("Green"));

      expect(addButtonFor("Green").getAttribute("aria-busy")).toBe("true");
      expect(addButtonFor("Blue")).toHaveProperty("disabled", true);
      expect(startButton()).toHaveProperty("disabled", true);

      await act(async () => {
        release({ ok: true, version: 0 });
        await Promise.resolve();
      });

      expect(addButtonFor("Blue")).toHaveProperty("disabled", false);
    });

    it("starts without filling seats unless asked", async () => {
      const { adapter, user } = renderLobby();

      await user.click(startButton());

      expect(adapter.commands).toEqual([{ name: "start", fillEmptySeatsWithAi: false }]);
    });

    it("sends the fill choice", async () => {
      const { adapter, user } = renderLobby();

      await user.click(screen.getByRole("switch", { name: /Fill empty seats/ }));
      await user.click(startButton());

      expect(adapter.commands).toEqual([{ name: "start", fillEmptySeatsWithAi: true }]);
    });

    it("drops the fill choice once every seat is taken", () => {
      renderLobby("p1", fullRoom);
      expect(screen.queryByRole("switch")).toBeNull();
      expect(screen.queryByText("Share the code to invite friends.")).toBeNull();
    });

    it("keeps the lobby and explains when there aren't enough players", async () => {
      const { adapter, store, user } = renderLobby();
      adapter.queueAck({
        ok: false,
        error: { code: "NOT_ENOUGH_PLAYERS", message: "No." },
      });

      await user.click(startButton());

      expect(store.getState().toasts[0]?.message).toBe(
        "You need at least 2 players. Add a computer player?",
      );
      expect(startButton()).toBeTruthy();
    });
  });

  describe("as a guest", () => {
    const withGuest = makeRoom({
      seats: makeRoom().seats.map((seat) =>
        seat.seat === 2 ? { ...seat, player: makePlayer("p2", "Hamza") } : seat,
      ),
    });

    it("waits, with no host controls", () => {
      renderLobby("p2", withGuest);

      expect(screen.getAllByText("Waiting for a player…")).toHaveLength(2);
      expect(screen.getByText("Waiting for Rida to start.")).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Start game" })).toBeNull();
      expect(screen.queryByRole("button", { name: /Add computer player/ })).toBeNull();
    });

    // Contract §4: "host changed" arrives as room:updated.
    it("gets the host controls if the server makes them host", () => {
      const { adapter } = renderLobby("p2", withGuest);

      act(() => {
        adapter.pushRoom({ ...withGuest, hostId: "p2" });
      });

      expect(startButton()).toBeTruthy();
    });
  });

  describe("leaving", () => {
    const leaveButton = () => screen.getByRole("button", { name: "Leave" });

    // FR-SYS-08 POST-08-1
    it("sends nothing and changes nothing on Cancel", async () => {
      const { adapter, store, user } = renderLobby();
      const before = store.getState().room;

      await user.click(leaveButton());
      expect(screen.getByText("Leave this game?")).toBeTruthy();
      await user.click(screen.getByRole("button", { name: "Cancel" }));

      expect(adapter.commands).toEqual([]);
      expect(store.getState().room).toBe(before);
      expect(screen.queryByText("Leave this game?")).toBeNull();
    });

    it("has Cancel focused first", async () => {
      const { user } = renderLobby();

      await user.click(leaveButton());

      expect(document.activeElement).toBe(screen.getByRole("button", { name: "Cancel" }));
    });

    it("leaves once confirmed", async () => {
      const { adapter, store, user } = renderLobby();

      await user.click(leaveButton());
      const dialog = screen.getByRole("dialog");
      const confirm = Array.from(dialog.querySelectorAll("button")).find(
        (button) => button.textContent === "Leave",
      );
      if (!confirm) throw new Error("the dialog has a Leave button");
      await user.click(confirm);

      expect(adapter.commands).toEqual([{ name: "leave" }]);
      expect(store.getState().room).toBeNull();
    });

    // FR-SYS-08 POST-08-3
    it("stays in the lobby with a visible error when leaving fails", async () => {
      const { adapter, store, user } = renderLobby();
      adapter.queueAck({ ok: false, error: { code: "INTERNAL_ERROR", message: "No." } });

      await user.click(leaveButton());
      const confirm = Array.from(screen.getByRole("dialog").querySelectorAll("button")).find(
        (button) => button.textContent === "Leave",
      );
      if (!confirm) throw new Error("the dialog has a Leave button");
      await user.click(confirm);

      expect(store.getState().room).not.toBeNull();
      expect(store.getState().toasts).toHaveLength(1);
      expect(screen.queryByText("Leave this game?")).toBeNull();
    });
  });
});
