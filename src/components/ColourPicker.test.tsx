import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { ColourPicker } from "@/components/ColourPicker";
import type { Colour } from "@/contract/types";

function Harness({ colours, start }: { colours: Colour[]; start: Colour | null }) {
  const [value, setValue] = useState<Colour | null>(start);
  return <ColourPicker label="Your colour" colours={colours} value={value} onChange={setValue} />;
}

const radio = (name: string) => screen.getByRole("radio", { name });
const checked = (name: string) => radio(name).getAttribute("aria-checked") === "true";

describe("ColourPicker", () => {
  it("offers only the colours it is given, in that order", () => {
    render(<Harness colours={["GREEN", "BLUE"]} start="GREEN" />);

    expect(screen.getAllByRole("radio").map((r) => r.getAttribute("aria-label"))).toEqual([
      "Green",
      "Blue",
    ]);
  });

  // NFR-SYS-08: arrow keys move and choose, wrapping round, and focus follows.
  it("moves between colours with the arrow keys", async () => {
    const user = userEvent.setup();
    render(<Harness colours={["RED", "GREEN", "YELLOW", "BLUE"]} start="RED" />);
    radio("Red").focus();

    await user.keyboard("{ArrowRight}");
    expect(checked("Green")).toBe(true);
    expect(document.activeElement).toBe(radio("Green"));

    await user.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(checked("Blue")).toBe(true);
  });

  it("lets Tab land on the first colour when none is chosen yet", () => {
    render(<Harness colours={["YELLOW", "BLUE"]} start={null} />);

    expect(radio("Yellow").tabIndex).toBe(0);
    expect(radio("Blue").tabIndex).toBe(-1);
  });

  // NFR-SYS-07: each colour has its letter, and the chosen one a tick, not just a colour.
  it("marks each colour with its letter and the chosen one with a tick", () => {
    render(<Harness colours={["RED", "BLUE"]} start="BLUE" />);

    expect(radio("Red").textContent).toContain("R");
    expect(radio("Blue").textContent).toContain("✓");
    expect(radio("Red").textContent).not.toContain("✓");
  });
});
