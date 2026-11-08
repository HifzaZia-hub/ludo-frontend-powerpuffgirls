import { act, render, screen } from "@testing-library/react";
import { CountdownRing } from "@/components/CountdownRing";

const MESSAGE = "Time's up — the computer will play for you.";

describe("CountdownRing", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("asks the clock again every second rather than counting down itself", () => {
    vi.useFakeTimers();
    const getSecondsLeft = vi.fn().mockReturnValueOnce(20).mockReturnValueOnce(20).mockReturnValue(7);
    render(<CountdownRing getSecondsLeft={getSecondsLeft} totalSeconds={30} />);
    expect(screen.getByRole("timer").getAttribute("aria-label")).toBe("20 seconds left");

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByRole("timer").getAttribute("aria-label")).toBe("7 seconds left");
  });

  it("shows the message at zero", () => {
    render(<CountdownRing getSecondsLeft={() => 0} totalSeconds={30} zeroMessage={MESSAGE} />);

    expect(screen.getByText(MESSAGE)).toBeTruthy();
  });

  it("holds the message back until zero, but keeps its space", () => {
    const { container } = render(
      <CountdownRing getSecondsLeft={() => 1} totalSeconds={30} zeroMessage={MESSAGE} />,
    );

    expect(screen.queryByText(MESSAGE)).toBeNull();
    expect(container.querySelector("p")?.textContent).toBe("");
  });

  it("keeps the space empty when there is nothing to say at zero", () => {
    const { container } = render(
      <CountdownRing getSecondsLeft={() => 0} totalSeconds={30} zeroMessage={null} />,
    );

    expect(container.querySelector("p")?.textContent).toBe("");
  });

  it("has no message area when none is asked for", () => {
    const { container } = render(<CountdownRing getSecondsLeft={() => 0} totalSeconds={30} />);

    expect(container.querySelector("p")).toBeNull();
  });

  it("shows no timer when the turn has no limit", () => {
    render(<CountdownRing getSecondsLeft={() => null} totalSeconds={0} zeroMessage={MESSAGE} />);

    expect(screen.queryByRole("timer")).toBeNull();
    expect(screen.queryByText(MESSAGE)).toBeNull();
  });
});
