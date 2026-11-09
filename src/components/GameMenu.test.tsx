import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GameMenu } from "@/components/GameMenu";

function setup(canRestart = true) {
  const onRestart = vi.fn();
  const onLeave = vi.fn();
  render(<GameMenu canRestart={canRestart} onRestart={onRestart} onLeave={onLeave} />);
  return { onRestart, onLeave, user: userEvent.setup() };
}

const trigger = () => screen.getByRole("button", { name: "Menu" });

describe("GameMenu", () => {
  it("is closed to begin with, and says so", () => {
    setup();

    expect(screen.queryByRole("button", { name: "Leave game" })).toBeNull();
    expect(trigger().getAttribute("aria-expanded")).toBe("false");
  });

  it("opens on a press", async () => {
    const { user } = setup();

    await user.click(trigger());

    expect(screen.getByRole("button", { name: "Leave game" })).toBeTruthy();
    expect(trigger().getAttribute("aria-expanded")).toBe("true");
  });

  it("offers Restart only to the host", async () => {
    const { user } = setup(false);

    await user.click(trigger());

    expect(screen.queryByRole("button", { name: "Restart" })).toBeNull();
    expect(screen.getByRole("button", { name: "Leave game" })).toBeTruthy();
  });

  it.each([
    ["Restart", "onRestart"],
    ["Leave game", "onLeave"],
  ] as const)("reports %s and closes", async (name, handler) => {
    const view = setup();
    await view.user.click(trigger());

    await view.user.click(screen.getByRole("button", { name }));

    expect(view[handler]).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name })).toBeNull();
  });

  // NFR-SYS-08: the dialog that opens next hands focus back to whatever had it.
  it("puts the keyboard back on Menu when a choice is made", async () => {
    const { user } = setup();
    await user.click(trigger());

    await user.click(screen.getByRole("button", { name: "Leave game" }));

    expect(document.activeElement).toBe(trigger());
  });

  it("closes on Escape, with the keyboard back on Menu", async () => {
    const { user } = setup();
    await user.click(trigger());

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("button", { name: "Leave game" })).toBeNull();
    expect(document.activeElement).toBe(trigger());
  });

  it("closes on a press anywhere else", async () => {
    const { user } = setup();
    await user.click(trigger());

    fireEvent.pointerDown(document.body);

    expect(screen.queryByRole("button", { name: "Leave game" })).toBeNull();
  });

  it("closes when pressed again", async () => {
    const { user } = setup();
    await user.click(trigger());

    await user.click(trigger());

    expect(screen.queryByRole("button", { name: "Leave game" })).toBeNull();
  });
});
