import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "@/components/Button";

describe("Button", () => {
  it("calls onClick when pressed", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Start</Button>);

    await user.click(screen.getByRole("button", { name: "Start" }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  // NFR-SYS-01
  it("shows a spinner and ignores presses while pending", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const { container } = render(
      <Button pending onClick={onClick}>
        Start
      </Button>,
    );

    await user.click(screen.getByRole("button", { name: "Start" }));

    expect(onClick).not.toHaveBeenCalled();
    expect(container.querySelector("[data-spinner]")).not.toBeNull();
    expect(screen.getByRole("button").getAttribute("aria-busy")).toBe("true");
  });

  // NFR-SYS-08
  it("keeps keyboard focus while pending", () => {
    const { rerender } = render(<Button>Start</Button>);
    const button = screen.getByRole("button");
    button.focus();

    rerender(<Button pending>Start</Button>);

    expect(document.activeElement).toBe(button);
    expect(button).toHaveProperty("disabled", false);
  });
});
