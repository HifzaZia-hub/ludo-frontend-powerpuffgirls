import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ErrorBoundary } from "@/components/ErrorBoundary";

interface BombProps {
  armed: { current: boolean };
}

function Bomb({ armed }: BombProps) {
  if (armed.current) throw new Error("boom");
  return <p>The board</p>;
}

const CRASH_MESSAGE = "Something went wrong — your game is safe";

describe("ErrorBoundary", () => {
  // React and the boundary both report the crash on purpose, which would bury the test output.
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => vi.restoreAllMocks());

  function boundary(armed: BombProps["armed"], resetKey: number, onResync: () => void) {
    return (
      <ErrorBoundary resetKey={resetKey} onResync={onResync}>
        <Bomb armed={armed} />
      </ErrorBoundary>
    );
  }

  it("draws its children when nothing is wrong", () => {
    render(boundary({ current: false }, 1, vi.fn()));

    expect(screen.getByText("The board")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  // NFR-SYS-03
  it("shows a way back instead of a blank page", () => {
    render(boundary({ current: true }, 1, vi.fn()));

    expect(screen.getByRole("alert").textContent).toBe(CRASH_MESSAGE);
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  });

  it("asks for the game again and redraws when pressed", async () => {
    const armed = { current: true };
    const onResync = vi.fn();
    render(boundary(armed, 1, onResync));

    armed.current = false;
    await userEvent.setup().click(screen.getByRole("button", { name: "Try again" }));

    expect(onResync).toHaveBeenCalledTimes(1);
    expect(screen.getByText("The board")).toBeTruthy();
  });

  it("comes back to the message if drawing still fails", async () => {
    render(boundary({ current: true }, 1, vi.fn()));

    await userEvent.setup().click(screen.getByRole("button", { name: "Try again" }));

    expect(screen.getByRole("alert").textContent).toBe(CRASH_MESSAGE);
  });

  it("recovers by itself when something new arrives", () => {
    const armed = { current: true };
    const onResync = vi.fn();
    const { rerender } = render(boundary(armed, 1, onResync));

    armed.current = false;
    rerender(boundary(armed, 2, onResync));

    expect(screen.getByText("The board")).toBeTruthy();
    expect(onResync).not.toHaveBeenCalled();
  });
});
