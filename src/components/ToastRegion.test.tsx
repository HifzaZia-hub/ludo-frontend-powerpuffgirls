import { act, render, screen } from "@testing-library/react";
import { ToastRegion } from "@/components/ToastRegion";

describe("ToastRegion", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps an error until it is dismissed", () => {
    const onDismiss = vi.fn();
    render(
      <ToastRegion toasts={[{ id: 1, kind: "error", message: "Oops" }]} onDismiss={onDismiss} />,
    );

    act(() => vi.advanceTimersByTime(60_000));

    expect(onDismiss).not.toHaveBeenCalled();
    expect(screen.queryByText("Oops")).not.toBeNull();
  });

  it("dismisses an info message by itself, once", () => {
    const onDismiss = vi.fn();
    render(<ToastRegion toasts={[{ id: 7, kind: "info", message: "Hi" }]} onDismiss={onDismiss} />);

    act(() => vi.advanceTimersByTime(4000));

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledWith(7);
  });

  it("doesn't restart the countdown when the parent re-renders", () => {
    const onDismiss = vi.fn();
    const toasts = [{ id: 7, kind: "info", message: "Hi" }] as const;
    const { rerender } = render(<ToastRegion toasts={toasts} onDismiss={onDismiss} />);

    act(() => vi.advanceTimersByTime(3000));
    rerender(<ToastRegion toasts={toasts} onDismiss={onDismiss} />);
    act(() => vi.advanceTimersByTime(1000));

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("is a polite live region even when empty", () => {
    const { container } = render(<ToastRegion toasts={[]} onDismiss={() => undefined} />);

    expect(container.querySelector("[aria-live='polite']")).not.toBeNull();
  });
});
