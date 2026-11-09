import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FakeAdapter } from "@/adapter/FakeAdapter";
import { StoppedScreen } from "@/screens/StoppedScreen";
import { createGameStore } from "@/store/gameStore";
import { useUiStore } from "@/store/uiStore";

function setup() {
  const adapter = new FakeAdapter();
  const store = createGameStore(adapter);
  adapter.connect("token");
  store.setState({ myPlayerId: "p1" });
  render(<StoppedScreen store={store} />);
  return { adapter, store, user: userEvent.setup() };
}

describe("StoppedScreen", () => {
  beforeEach(() => {
    useUiStore.setState({ screen: "stopped", modal: null });
  });

  it("says what happened", () => {
    setup();

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("This game was stopped");
  });

  it.each([
    ["New game", "setup"],
    ["Main menu", "main"],
  ] as const)("%s lets go of the game without asking the server", async (name, destination) => {
    const { adapter, store, user } = setup();

    await user.click(screen.getByRole("button", { name }));

    expect(useUiStore.getState().screen).toBe(destination);
    expect(store.getState().myPlayerId).toBeNull();
    expect(adapter.connectedToken).toBeNull();
    expect(adapter.commands).toEqual([]);
  });
});
