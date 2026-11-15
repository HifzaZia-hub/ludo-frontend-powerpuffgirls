import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConnectionBanner } from "@/components/ConnectionBanner";

describe("ConnectionBanner", () => {
  it("shows nothing while connected", () => {
    const { container } = render(<ConnectionBanner status={null} onRetry={vi.fn()} />);

    expect(container.querySelector("[data-connection]")).toBeNull();
  });

  // A screen reader only announces changes to a live region that already exists.
  it("keeps its live region on the page even when empty", () => {
    const { container } = render(<ConnectionBanner status={null} onRetry={vi.fn()} />);

    expect(container.querySelector('[aria-live="polite"]')).not.toBeNull();
  });

  it("says it is reconnecting, with nothing to press", () => {
    render(<ConnectionBanner status="reconnecting" onRetry={vi.fn()} />);

    expect(screen.getByText("Reconnecting…")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("offers Try again when disconnected", async () => {
    const onRetry = vi.fn();
    render(<ConnectionBanner status="lost" onRetry={onRetry} />);

    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(screen.getByText("Disconnected")).toBeTruthy();
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
