import { render, screen, within } from "@testing-library/react";
import { StatusPanel, type StatusPanelPlayer } from "@/components/StatusPanel";

const PLAYERS: StatusPanelPlayer[] = [
  { id: "p1", colour: "RED", name: "Rida", tag: "you", counts: { base: 1, track: 2, home: 1 } },
  {
    id: "p2",
    colour: "GREEN",
    name: "Computer 1",
    tag: "computer",
    counts: { base: 4, track: 0, home: 0 },
    active: true,
  },
];

describe("StatusPanel", () => {
  it("shows one card per player in the order it is given", () => {
    render(<StatusPanel players={PLAYERS} />);

    const names = screen.getAllByRole("listitem").map((item) => item.querySelector("p")?.textContent);
    expect(names).toEqual(["Rida", "Computer 1"]);
  });

  // FR-SYS-06
  it("shows base, track and home for each player", () => {
    render(<StatusPanel players={PLAYERS} />);

    const [first] = screen.getAllByRole("listitem");
    if (!first) throw new Error("expected a card");
    const counts = within(first)
      .getAllByRole("definition")
      .map((count) => count.textContent);
    expect(counts).toEqual(["1", "2", "1"]);
  });

  it("marks only the active player's card", () => {
    const { container } = render(<StatusPanel players={PLAYERS} />);

    const active = container.querySelectorAll('[aria-current="true"]');
    expect(active).toHaveLength(1);
    expect(active[0]?.textContent).toContain("Computer 1");
  });

  // NFR-SYS-07: colour, shape and letter, not colour alone.
  it("identifies each player by more than colour", () => {
    render(<StatusPanel players={PLAYERS} />);

    expect(screen.getByRole("img", { name: "Red" }).textContent).toContain("R");
    expect(screen.getByRole("img", { name: "Green" }).querySelector("svg")).not.toBeNull();
  });
});
