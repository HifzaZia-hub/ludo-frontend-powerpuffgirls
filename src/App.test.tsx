import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FakeAdapter } from "@/adapter/FakeAdapter";
import { App } from "@/App";
import type { GameStateSnapshot } from "@/contract/types";
import { createGameStore } from "@/store/gameStore";
import { useSettingsStore } from "@/store/settingsStore";

function renderApp(adapter = new FakeAdapter()) {
  render(<App store={createGameStore(adapter)} />);
  return adapter;
}

describe("starter page theme switch", () => {
  beforeEach(() => {
    useSettingsStore.setState({ theme: "dark" });
  });

  it("sets data-theme on <html> and marks the chosen button", async () => {
    const user = userEvent.setup();
    renderApp();
    const light = screen.getByRole("button", { name: "Light" });

    await user.click(light);

    expect(document.documentElement.dataset.theme).toBe("light");
    expect(light.getAttribute("aria-pressed")).toBe("true");

    await user.click(screen.getByRole("button", { name: "Dark" }));

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(light.getAttribute("aria-pressed")).toBe("false");
  });

  // NFR-SYS-08: everything works without a mouse.
  it("switches theme from the keyboard", async () => {
    const user = userEvent.setup();
    renderApp();

    screen.getByRole("button", { name: "Light" }).focus();
    await user.keyboard("{Enter}");

    expect(document.documentElement.dataset.theme).toBe("light");
  });
});

describe("debug line", () => {
  it("shows the connection and the latest snapshot version", () => {
    const adapter = renderApp();
    expect(screen.getByRole("status").textContent).toContain("not started");

    act(() => {
      adapter.pushConnection("live");
      adapter.pushState({ version: 7, matchId: "match-1" } as GameStateSnapshot);
    });

    expect(screen.getByRole("status").textContent).toBe("Connection: live · Game version: 7");
  });

  it("shows the friendly message when the test game can't start", async () => {
    const user = userEvent.setup();
    const adapter = new FakeAdapter();
    adapter.createRoomResult = {
      ok: false,
      error: { code: "INTERNAL_ERROR", message: "Could not reach the server." },
    };
    renderApp(adapter);

    await user.click(screen.getByRole("button", { name: "Start test game" }));

    expect(screen.getByText("Something went wrong. Your game is safe — try again.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Start test game" })).toHaveProperty(
      "disabled",
      false,
    );
  });
});
