import { render, screen } from "@testing-library/react";
import { BoardGrid } from "@/components/BoardGrid";
import { START_SQUARE, TRACK_CELLS } from "@/config/board";

function renderGrid(safeSquares: readonly number[] = [0, 8]) {
  return render(<BoardGrid safeSquares={safeSquares} />).container;
}

function cell(container: HTMLElement, square: number): HTMLElement {
  const found = container.querySelector<HTMLElement>(`[data-square="${square}"]`);
  if (!found) throw new Error(`No cell for square ${square}`);
  return found;
}

describe("BoardGrid", () => {
  it("draws all the parts of the board", () => {
    const container = renderGrid();

    expect(container.querySelectorAll("[data-square]")).toHaveLength(TRACK_CELLS.length);
    expect(container.querySelectorAll("[data-yard]")).toHaveLength(4);
    expect(container.querySelectorAll("[data-yard-slot]")).toHaveLength(16);
    expect(container.querySelectorAll("[data-home-column]")).toHaveLength(20);
    expect(container.querySelectorAll("[data-entry-arrow]")).toHaveLength(4);
    expect(container.querySelectorAll("[data-centre] polygon")).toHaveLength(4);
  });

  it("places track cells from the board config", () => {
    const container = renderGrid();

    // Square 12 is [8,0]. Grid lines count from 1.
    expect(cell(container, 12).style.gridColumn).toContain("9");
    expect(cell(container, 12).style.gridRow).toContain("1");
  });

  // NFR-SYS-11: stars come from the rules it is given. No list of squares lives in the component.
  it("puts stars only on the squares the rules list", () => {
    const container = renderGrid([5, 20, 51]);

    expect(screen.getAllByRole("img", { name: "Safe square" })).toHaveLength(3);
    for (const square of [5, 20, 51]) {
      expect(cell(container, square).querySelector("svg")).not.toBeNull();
    }
    expect(cell(container, 0).querySelector("svg")).toBeNull();
    expect(cell(container, 8).querySelector("svg")).toBeNull();
  });

  it("moves the stars when the rules change", () => {
    const { container, rerender } = render(<BoardGrid safeSquares={[1]} />);
    expect(cell(container, 1).querySelector("svg")).not.toBeNull();

    rerender(<BoardGrid safeSquares={[2]} />);

    expect(cell(container, 1).querySelector("svg")).toBeNull();
    expect(cell(container, 2).querySelector("svg")).not.toBeNull();
  });

  it("marks a start square even when the rules don't make it safe", () => {
    const container = renderGrid([]);
    const red = cell(container, START_SQUARE.RED);

    expect(red.querySelector("svg")).toBeNull();
    expect(red.className).not.toContain("bg-board-cell");
    expect(cell(container, 1).className).toContain("bg-board-cell");
  });
});
