import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { SegmentedControl } from "@/components/SegmentedControl";

const OPTIONS = [
  { value: "2", label: "Two" },
  { value: "3", label: "Three" },
  { value: "4", label: "Four" },
] as const;

function Harness() {
  const [value, setValue] = useState<"2" | "3" | "4">("2");
  return <SegmentedControl label="Players" options={OPTIONS} value={value} onChange={setValue} />;
}

function radio(name: string): HTMLElement {
  return screen.getByRole("radio", { name });
}

describe("SegmentedControl (NFR-SYS-08)", () => {
  it("moves the selection and focus with the arrow keys", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    radio("Two").focus();
    await user.keyboard("{ArrowRight}");

    expect(radio("Three").getAttribute("aria-checked")).toBe("true");
    expect(document.activeElement).toBe(radio("Three"));
  });

  it("wraps round at both ends", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    radio("Two").focus();
    await user.keyboard("{ArrowLeft}");
    expect(radio("Four").getAttribute("aria-checked")).toBe("true");

    await user.keyboard("{ArrowRight}");
    expect(radio("Two").getAttribute("aria-checked")).toBe("true");
  });

  // The highlight is one element that moves to the new choice, so it can glide there.
  it("draws one highlight, on the chosen option", async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness />);
    const highlights = () => container.querySelectorAll("[data-highlight]");

    expect(highlights()).toHaveLength(1);
    expect(radio("Two").querySelector("[data-highlight]")).not.toBeNull();

    await user.click(radio("Four"));

    expect(highlights()).toHaveLength(1);
    expect(radio("Four").querySelector("[data-highlight]")).not.toBeNull();
    expect(highlights()[0]?.getAttribute("aria-hidden")).toBe("true");
  });

  it("is a single Tab stop, on the chosen option", () => {
    render(<Harness />);

    expect(radio("Two").tabIndex).toBe(0);
    expect(radio("Three").tabIndex).toBe(-1);
    expect(radio("Four").tabIndex).toBe(-1);
  });
});
