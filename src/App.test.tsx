import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "@/App";

describe("starter page theme switch", () => {
  beforeEach(() => {
    document.documentElement.dataset.theme = "dark";
  });

  it("sets data-theme on <html> and marks the chosen button", async () => {
    const user = userEvent.setup();
    render(<App />);
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
    render(<App />);

    screen.getByRole("button", { name: "Light" }).focus();
    await user.keyboard("{Enter}");

    expect(document.documentElement.dataset.theme).toBe("light");
  });
});
