import { render, screen } from "@testing-library/react";
import { EventBanner } from "@/components/EventBanner";

describe("EventBanner", () => {
  it("shows its words", () => {
    render(<EventBanner text="Roll again!" />);

    expect(screen.getByText("Roll again!")).toBeTruthy();
  });

  it("is absent with nothing to say", () => {
    const { container } = render(<EventBanner text={null} />);

    expect(container.firstChild).toBeNull();
  });

  // The message log already announces the same event.
  it("isn't read out a second time", () => {
    const { container } = render(<EventBanner text="Roll again!" />);

    expect(container.querySelector("[data-banner]")?.getAttribute("aria-hidden")).toBe("true");
  });
});
