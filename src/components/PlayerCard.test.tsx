import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PlayerCard } from "@/components/PlayerCard";

const COUNTS = { base: 4, track: 0, home: 0 };

describe("PlayerCard", () => {
  // D2 FR-29: the wins used to share the name's line and cut "Computer 2" down to "Compute…".
  it("puts the session wins on the line under the name, so the name keeps its room", () => {
    render(<PlayerCard colour="GREEN" name="Computer 2" tag="computer" counts={COUNTS} wins={1} />);

    const name = screen.getByText("Computer 2");
    const wins = screen.getByText("1 win");
    expect(name.contains(wins)).toBe(false);
    expect(name.nextElementSibling?.contains(wins)).toBe(true);
    // A real space between them, so a screen reader doesn't run the words together.
    expect(name.nextElementSibling?.textContent).toBe("Computer 1 win");
  });

  it("shows the wins even for a player with no tag", () => {
    render(<PlayerCard colour="BLUE" name="Hamza" counts={COUNTS} wins={2} />);

    expect(screen.getByText("Hamza").nextElementSibling?.textContent).toBe("2 wins");
  });

  it("shows no wins line before anyone has won", () => {
    render(<PlayerCard colour="RED" name="Rida" counts={COUNTS} />);

    expect(screen.getByText("Rida").nextElementSibling).toBeNull();
    expect(screen.queryByText(/win/)).toBeNull();
  });

  it("keeps the whole name in a title, for a name too long to fit", () => {
    const long = "Maryam the Magnificent";
    render(<PlayerCard colour="YELLOW" name={long} counts={COUNTS} />);

    expect(screen.getByText(long).getAttribute("title")).toBe(long);
  });
});
