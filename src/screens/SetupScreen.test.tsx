import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FakeAdapter } from "@/adapter/FakeAdapter";
import type { CreateRoomResponse } from "@/contract/types";
import { SetupScreen } from "@/screens/SetupScreen";
import { createGameStore } from "@/store/gameStore";
import { useUiStore } from "@/store/uiStore";
import { makeRoom } from "@/testRoom";

const CREATED: { ok: true; data: CreateRoomResponse } = {
  ok: true,
  data: { v: "1.0.0", roomCode: "K7QX2M", playerId: "p1", sessionToken: "t", room: makeRoom() },
};

function renderSetup() {
  const adapter = new FakeAdapter();
  adapter.createRoomResult = CREATED;
  const store = createGameStore(adapter);
  render(<SetupScreen store={store} />);
  return { adapter, store, user: userEvent.setup() };
}

const nameField = () => screen.getByLabelText<HTMLInputElement>("Your name");
const startButton = () => screen.getByRole("button", { name: "Start" });
const isChosen = (name: string) =>
  screen.getByRole("radio", { name }).getAttribute("aria-checked") === "true";

describe("SetupScreen", () => {
  beforeEach(() => {
    sessionStorage.clear();
    useUiStore.setState({ screen: "setup", modal: null, lastSetup: null });
  });

  it("sends a game with friends, with no difficulty, and goes to the lobby", async () => {
    const { adapter, user } = renderSetup();

    await user.click(screen.getByRole("radio", { name: "2" }));
    await user.click(screen.getByRole("radio", { name: "Play with friends" }));
    await user.type(nameField(), "Rida");
    await user.click(startButton());

    expect(adapter.createRequests).toEqual([
      { displayName: "Rida", mode: "HUMAN_VS_HUMAN", seats: 2 },
    ]);
    expect(useUiStore.getState().screen).toBe("lobby");
  });

  it("sends the chosen difficulty for a game against the computer", async () => {
    const { adapter, user } = renderSetup();

    await user.click(screen.getByRole("radio", { name: "Play with computer" }));
    await user.click(screen.getByRole("radio", { name: "Easy" }));
    await user.type(nameField(), "Maryam");
    await user.click(startButton());

    expect(adapter.createRequests).toEqual([
      { displayName: "Maryam", mode: "HUMAN_VS_AI", seats: 4, aiDifficulty: "EASY" },
    ]);
  });

  it("only asks about difficulty when there are computer players", async () => {
    const { user } = renderSetup();
    expect(screen.queryByRole("radiogroup", { name: "Computer difficulty" })).not.toBeNull();

    await user.click(screen.getByRole("radio", { name: "Play with friends" }));

    expect(screen.queryByRole("radiogroup", { name: "Computer difficulty" })).toBeNull();
  });

  it("shows the colour the player will get, with its letter", () => {
    renderSetup();
    expect(screen.getByRole("img", { name: "Red" }).textContent).toContain("R");
  });

  // FR-SYS-01 ALT-01-1, EXC-01-1
  it("keeps every choice after NAME_TAKEN, shows it under the name, and retries in one press", async () => {
    const { adapter, store, user } = renderSetup();
    adapter.createRoomResult = {
      ok: false,
      error: { code: "NAME_TAKEN", message: "Taken." },
    };

    await user.click(screen.getByRole("radio", { name: "3" }));
    await user.click(screen.getByRole("radio", { name: "Easy" }));
    await user.type(nameField(), "Rida");
    await user.click(startButton());

    expect(nameField().value).toBe("Rida");
    expect(isChosen("3")).toBe(true);
    expect(isChosen("Play with computer")).toBe(true);
    expect(isChosen("Easy")).toBe(true);
    expect(nameField().getAttribute("aria-invalid")).toBe("true");
    expect(
      screen.getByText("Someone in this game already has that name. Try another."),
    ).toBeTruthy();
    expect(document.activeElement).toBe(nameField());
    expect(store.getState().toasts).toEqual([]);
    expect(useUiStore.getState().screen).toBe("setup");

    adapter.createRoomResult = CREATED;
    await user.click(startButton());

    expect(adapter.createRequests).toHaveLength(2);
    expect(useUiStore.getState().screen).toBe("lobby");
  });

  it("keeps every choice and shows a toast when the server is busy", async () => {
    const { adapter, store, user } = renderSetup();
    adapter.createRoomResult = { ok: false, error: { code: "SERVER_BUSY", message: "Full." } };

    await user.type(nameField(), "Rida");
    await user.click(startButton());

    expect(nameField().value).toBe("Rida");
    expect(store.getState().toasts[0]?.message).toBe(
      "The game server is busy. Try again in a minute.",
    );
    expect(startButton().getAttribute("aria-busy")).toBeNull();
  });

  it.each(["", "Rida!"])("catches the name %j without asking the server", async (typed) => {
    const { adapter, user } = renderSetup();

    if (typed) await user.type(nameField(), typed);
    await user.click(startButton());

    expect(adapter.createRequests).toEqual([]);
    expect(screen.getByText("Use 1–20 letters or numbers for your name.")).toBeTruthy();
    expect(nameField().value).toBe(typed);
  });

  it("clears the name error as soon as the player starts fixing it", async () => {
    const { user } = renderSetup();

    await user.click(startButton());
    await user.type(nameField(), "R");

    expect(screen.queryByText("Use 1–20 letters or numbers for your name.")).toBeNull();
  });

  // NFR-SYS-01, and a second press must not create a second room.
  it("shows the press at once and sends only one request", async () => {
    const { adapter, user } = renderSetup();
    let finish: (value: typeof CREATED) => void = () => undefined;
    const createRoom = vi.spyOn(adapter, "createRoom").mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );

    await user.type(nameField(), "Rida");
    await user.click(startButton());

    expect(startButton().getAttribute("aria-busy")).toBe("true");
    expect(screen.getByRole("button", { name: "Back" })).toHaveProperty("disabled", true);

    await user.click(startButton());
    expect(createRoom).toHaveBeenCalledTimes(1);

    finish(CREATED);
    await vi.waitFor(() => expect(useUiStore.getState().screen).toBe("lobby"));
  });

  // D2 FR-33
  describe("after an earlier game", () => {
    it("starts from the choices of the last game", () => {
      useUiStore.setState({
        lastSetup: { seats: "3", mode: "HUMAN_VS_HUMAN", difficulty: "EASY", name: "Rida" },
      });

      renderSetup();

      expect(isChosen("3")).toBe(true);
      expect(isChosen("Play with friends")).toBe(true);
      expect(nameField().value).toBe("Rida");
    });

    it("remembers what was sent, in memory only", async () => {
      const { user } = renderSetup();
      const stored = localStorage.length;

      await user.type(nameField(), " Maryam ");
      await user.click(startButton());

      expect(useUiStore.getState().lastSetup).toEqual({
        seats: "4",
        mode: "HUMAN_VS_AI",
        difficulty: "NORMAL",
        name: "Maryam",
      });
      expect(localStorage.length).toBe(stored);
    });
  });

  it("goes back to the main screen", async () => {
    const { user } = renderSetup();

    await user.click(screen.getByRole("button", { name: "Back" }));

    expect(useUiStore.getState().screen).toBe("main");
  });

  // NFR-SYS-08
  it("can be filled in and sent from the keyboard alone", async () => {
    const { adapter, user } = renderSetup();

    screen.getByRole("radio", { name: "4" }).focus();
    await user.keyboard("{ArrowLeft}");
    await user.tab(); // to Game type
    await user.keyboard("{ArrowLeft}");
    await user.tab(); // choosing friends removed the difficulty, so this goes straight to the name
    expect(document.activeElement).toBe(nameField());
    await user.keyboard("Rida{Enter}");

    expect(adapter.createRequests).toEqual([
      { displayName: "Rida", mode: "HUMAN_VS_HUMAN", seats: 3 },
    ]);
  });
});
