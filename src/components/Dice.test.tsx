import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Dice } from "@/components/Dice";

function pipCount(container: HTMLElement): number {
  return container.querySelectorAll("[data-pip]").length;
}

describe("Dice", () => {
  // NFR-SYS-05, FR-SYS-02 POST-02-2
  it("shows exactly the server's value once rolling ends", () => {
    const noop = () => undefined;
    const { container, rerender } = render(
      <Dice value={2} rolling disabled={false} onRoll={noop} />,
    );

    rerender(<Dice value={5} rolling={false} disabled={false} onRoll={noop} />);

    expect(pipCount(container)).toBe(5);
    expect(screen.getByRole("button").getAttribute("aria-label")).toContain("shows 5");
  });

  it("lands on a 6 when the server rolled a 6", () => {
    const noop = () => undefined;
    const { container, rerender } = render(
      <Dice value={6} rolling disabled={false} onRoll={noop} />,
    );
    expect(pipCount(container)).toBe(0);

    rerender(<Dice value={6} rolling={false} disabled={false} onRoll={noop} />);

    expect(pipCount(container)).toBe(6);
  });

  // NFR-SYS-08: a natively disabled button would lose keyboard focus after every roll.
  it("keeps keyboard focus while it can't be pressed", () => {
    const noop = () => undefined;
    const { rerender } = render(<Dice value={null} rolling={false} disabled={false} onRoll={noop} />);
    const die = screen.getByRole<HTMLButtonElement>("button");
    die.focus();

    rerender(<Dice value={null} rolling disabled={false} onRoll={noop} />);

    expect(die.disabled).toBe(false);
    expect(die.getAttribute("aria-disabled")).toBe("true");
    expect(document.activeElement).toBe(die);
  });

  it("says it can be pressed when it can", () => {
    render(<Dice value={null} rolling={false} disabled={false} onRoll={() => undefined} />);

    expect(screen.getByRole("button").hasAttribute("aria-disabled")).toBe(false);
  });

  it.each([1, 2, 3, 4, 5, 6])("draws %i pips for a %i", (value) => {
    const { container } = render(
      <Dice value={value} rolling={false} disabled={false} onRoll={() => undefined} />,
    );

    expect(pipCount(container)).toBe(value);
  });

  // NFR-SYS-05: while tumbling there is no value to show, so none is shown.
  it("shows no number while rolling, even with an older value", () => {
    const { container } = render(
      <Dice value={4} rolling disabled={false} onRoll={() => undefined} />,
    );

    expect(pipCount(container)).toBe(0);
    expect(screen.getByRole("button").getAttribute("aria-label")).toBe("Rolling the dice");
  });

  // FR-SYS-02 EXC-02-1
  it("ignores presses while rolling or disabled", async () => {
    const user = userEvent.setup();
    const onRoll = vi.fn();
    const { rerender } = render(<Dice value={null} rolling disabled={false} onRoll={onRoll} />);

    await user.click(screen.getByRole("button"));
    rerender(<Dice value={null} rolling={false} disabled onRoll={onRoll} />);
    await user.click(screen.getByRole("button"));

    expect(onRoll).not.toHaveBeenCalled();
  });

  it("rolls from the keyboard", async () => {
    const user = userEvent.setup();
    const onRoll = vi.fn();
    render(<Dice value={null} rolling={false} disabled={false} onRoll={onRoll} />);

    screen.getByRole("button").focus();
    await user.keyboard("{Enter}");

    expect(onRoll).toHaveBeenCalledTimes(1);
  });
});
