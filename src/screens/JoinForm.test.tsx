import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FakeAdapter } from "@/adapter/FakeAdapter";
import type { Result, RoomPreview } from "@/adapter/GameAdapter";
import type { JoinRoomResponse, ServerError } from "@/contract/types";
import { JoinForm } from "@/screens/JoinForm";
import { createGameStore } from "@/store/gameStore";
import { useUiStore } from "@/store/uiStore";
import { makeRoom } from "@/testRoom";

const JOINED: { ok: true; data: JoinRoomResponse } = {
  ok: true,
  data: { v: "1.0.0", playerId: "p2", sessionToken: "t", room: makeRoom() },
};
const FOUND: Result<RoomPreview> = { ok: true, data: {} };

function failure(code: ServerError["code"]): { ok: false; error: ServerError } {
  return { ok: false, error: { code, message: "No." } };
}

function renderJoin() {
  const adapter = new FakeAdapter();
  adapter.previewRoomResult = FOUND;
  adapter.joinRoomResult = JOINED;
  const store = createGameStore(adapter);
  render(<JoinForm store={store} codeFieldRef={createRef()} />);
  return { adapter, store, user: userEvent.setup() };
}

const codeField = () => screen.getByLabelText<HTMLInputElement>("Game code");
const nameField = () => screen.getByLabelText<HTMLInputElement>("Your name");
const queryNameField = () => screen.queryByLabelText("Your name");
const joinButton = () => screen.getByRole("button", { name: "Join" });

describe("JoinForm", () => {
  beforeEach(() => {
    sessionStorage.clear();
    useUiStore.setState({ screen: "main", modal: null });
  });

  it("upper-cases as you type", async () => {
    const { user } = renderJoin();
    await user.type(codeField(), "k7q");
    expect(codeField().value).toBe("K7Q");
  });

  // Contract §2
  it("refuses a character outside the alphabet and says why", async () => {
    const { user } = renderJoin();

    await user.type(codeField(), "K7O");
    expect(codeField().value).toBe("K7");
    expect(
      screen.getByText("Codes don't use the letters I, L or O, or the numbers 0 or 1."),
    ).toBeTruthy();

    await user.type(codeField(), "Q");
    expect(codeField().value).toBe("K7Q");
    expect(screen.queryByText(/Codes don't use/)).toBeNull();
  });

  it("doesn't look anything up or ask for a name before all six characters", async () => {
    const { adapter, user } = renderJoin();

    await user.type(codeField(), "K7QX2");

    expect(adapter.previewCodes).toEqual([]);
    expect(queryNameField()).toBeNull();
  });

  it("looks the code up at six characters, then asks for a name", async () => {
    const { adapter, user } = renderJoin();

    await user.type(codeField(), "K7QX2M");

    expect(adapter.previewCodes).toEqual(["K7QX2M"]);
    expect(await screen.findByText("Game found! Now type your name.")).toBeTruthy();
    expect(queryNameField()).not.toBeNull();
  });

  it("shows an unknown code under the code field and doesn't ask for a name", async () => {
    const { adapter, user } = renderJoin();
    adapter.previewRoomResult = failure("ROOM_NOT_FOUND");

    await user.type(codeField(), "K7QX2M");

    expect(await screen.findByText("We couldn't find that game. Check the code.")).toBeTruthy();
    expect(queryNameField()).toBeNull();
    expect(codeField().value).toBe("K7QX2M");
  });

  it("ignores the answer about a code that has since been changed", async () => {
    const { adapter, user } = renderJoin();
    let answer: (value: Result<RoomPreview>) => void = () => undefined;
    vi.spyOn(adapter, "previewRoom").mockReturnValueOnce(
      new Promise((resolve) => {
        answer = resolve;
      }),
    );

    await user.type(codeField(), "K7QX2M");
    await user.type(codeField(), "{Backspace}");
    answer(FOUND);
    await Promise.resolve();

    expect(screen.queryByText("Game found! Now type your name.")).toBeNull();
    expect(queryNameField()).toBeNull();
  });

  // The look-up is only a convenience. Joining still gives the real answer.
  it("still lets the player try to join when the look-up itself fails", async () => {
    const { adapter, user } = renderJoin();
    adapter.previewRoomResult = failure("SERVER_BUSY");

    await user.type(codeField(), "K7QX2M");

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(queryNameField()).not.toBeNull();
  });

  it("explains an incomplete code instead of sending it", async () => {
    const { adapter, user } = renderJoin();

    await user.type(codeField(), "K7Q");
    await user.click(joinButton());

    expect(adapter.joinRequests).toEqual([]);
    expect(
      screen.getByText("That code doesn't look right. It has 6 letters and numbers."),
    ).toBeTruthy();
  });

  it("joins with the trimmed name and goes to the lobby", async () => {
    const { adapter, user } = renderJoin();

    await user.type(codeField(), "K7QX2M");
    await user.type(await screen.findByLabelText("Your name"), " Hamza ");
    await user.click(joinButton());

    expect(adapter.joinRequests).toEqual([{ code: "K7QX2M", request: { displayName: "Hamza" } }]);
    expect(useUiStore.getState().screen).toBe("lobby");
  });

  it("catches a bad name without asking the server", async () => {
    const { adapter, user } = renderJoin();

    await user.type(codeField(), "K7QX2M");
    await user.type(await screen.findByLabelText("Your name"), "Hamza!");
    await user.click(joinButton());

    expect(adapter.joinRequests).toEqual([]);
    expect(screen.getByText("Use 1–20 letters or numbers for your name.")).toBeTruthy();
  });

  // FR-SYS-01 ALT-01-1, EXC-01-1
  it("keeps both fields after NAME_TAKEN and retries in one press", async () => {
    const { adapter, user } = renderJoin();
    adapter.joinRoomResult = failure("NAME_TAKEN");

    await user.type(codeField(), "K7QX2M");
    await user.type(await screen.findByLabelText("Your name"), "Hamza");
    await user.click(joinButton());

    expect(codeField().value).toBe("K7QX2M");
    expect(nameField().value).toBe("Hamza");
    expect(
      screen.getByText("Someone in this game already has that name. Try another."),
    ).toBeTruthy();
    expect(document.activeElement).toBe(nameField());

    adapter.joinRoomResult = JOINED;
    await user.click(joinButton());

    expect(adapter.joinRequests).toHaveLength(2);
    expect(useUiStore.getState().screen).toBe("lobby");
  });

  it.each([
    ["ROOM_FULL", "That game is full."],
    ["GAME_ALREADY_STARTED", "That game has already started."],
  ] as const)("shows %s under the code and keeps the name", async (code, message) => {
    const { adapter, user } = renderJoin();
    adapter.joinRoomResult = failure(code);

    await user.type(codeField(), "K7QX2M");
    await user.type(await screen.findByLabelText("Your name"), "Hamza");
    await user.click(joinButton());

    expect(screen.getByText(message)).toBeTruthy();
    expect(codeField().getAttribute("aria-invalid")).toBe("true");
    expect(nameField().value).toBe("Hamza");
    expect(screen.queryByText("Game found! Now type your name.")).toBeNull();
  });

  it.each([
    ["SERVER_BUSY", "The game server is busy. Try again in a minute."],
    ["RATE_LIMITED", "Slow down a little and try again."],
  ] as const)("shows %s inside the form and keeps both fields", async (code, message) => {
    const { adapter, store, user } = renderJoin();
    adapter.joinRoomResult = failure(code);

    await user.type(codeField(), "K7QX2M");
    await user.type(await screen.findByLabelText("Your name"), "Hamza");
    await user.click(joinButton());

    expect(screen.getByRole("alert").textContent).toBe(message);
    expect(store.getState().toasts).toEqual([]);
    expect(codeField().value).toBe("K7QX2M");
    expect(nameField().value).toBe("Hamza");
    expect(joinButton().getAttribute("aria-busy")).toBeNull();
  });

  // NFR-SYS-08
  it("can be finished from the keyboard alone", async () => {
    const { adapter, user } = renderJoin();

    codeField().focus();
    await user.keyboard("k7qx2m");
    await screen.findByLabelText("Your name");
    await user.tab();
    expect(document.activeElement).toBe(nameField());
    await user.keyboard("Hamza{Enter}");

    expect(adapter.joinRequests).toHaveLength(1);
  });
});
