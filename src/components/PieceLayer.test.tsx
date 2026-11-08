import { render, screen } from "@testing-library/react";
import { PieceLayer } from "@/components/PieceLayer";
import { cellKey, pieceCell, piecePlacement, stackOffsets } from "@/config/geometry";
import type { Colour, Piece } from "@/contract/types";

function makePiece(id: string, colour: Colour, step: number, boardSquare: number | null): Piece {
  return { id, colour, step, boardSquare };
}

function groupByCell(pieces: readonly Piece[]): ReadonlyMap<string, readonly Piece[]> {
  const cells = new Map<string, Piece[]>();
  for (const piece of pieces) {
    const key = cellKey(pieceCell(piece));
    cells.set(key, [...(cells.get(key) ?? []), piece]);
  }
  return cells;
}

function layer(pieces: readonly Piece[], safeSquares: readonly number[] = []) {
  return (
    <PieceLayer
      pieces={pieces}
      piecesByCell={groupByCell(pieces)}
      safeSquares={safeSquares}
      tweenSeconds={0}
    />
  );
}

function pieceElement(container: HTMLElement, id: string): HTMLElement {
  const found = container.querySelector<HTMLElement>(`[data-piece="${id}"]`);
  if (!found) throw new Error(`No element for piece ${id}`);
  return found;
}

const TRACK_PIECE = makePiece("R1", "RED", 3, 2);

describe("PieceLayer", () => {
  it("draws one piece for each piece it is given", () => {
    const pieces = [TRACK_PIECE, makePiece("Y1", "YELLOW", 0, null)];
    const { container } = render(layer(pieces));

    expect(container.querySelectorAll("[data-piece]")).toHaveLength(2);
  });

  it("puts a piece exactly where the geometry says", () => {
    const { container } = render(layer([TRACK_PIECE]));
    const expected = piecePlacement(pieceCell(TRACK_PIECE), { dx: 0, dy: 0, scale: 1 });

    const element = pieceElement(container, "R1");
    expect(parseFloat(element.style.left)).toBeCloseTo(expected.left);
    expect(parseFloat(element.style.top)).toBeCloseTo(expected.top);
    expect(parseFloat(element.style.width)).toBeCloseTo(expected.size);
  });

  it("fans out pieces that share a cell", () => {
    const first = makePiece("R1", "RED", 5, 4);
    const second = makePiece("R2", "RED", 5, 4);
    const { container } = render(layer([first, second]));
    const [leftOffset, rightOffset] = stackOffsets(2);
    if (!leftOffset || !rightOffset) throw new Error("two pieces get two offsets");
    const point = pieceCell(first);

    expect(parseFloat(pieceElement(container, "R1").style.left)).toBeCloseTo(
      piecePlacement(point, leftOffset).left,
    );
    expect(parseFloat(pieceElement(container, "R2").style.left)).toBeCloseTo(
      piecePlacement(point, rightOffset).left,
    );
  });

  it("keeps the same element when a piece moves, so it can't teleport", () => {
    const { container, rerender } = render(layer([TRACK_PIECE]));
    const before = pieceElement(container, "R1");
    const leftBefore = before.style.left;

    rerender(layer([{ ...TRACK_PIECE, step: 9, boardSquare: 8 }]));

    expect(pieceElement(container, "R1")).toBe(before);
    expect(before.style.left).not.toBe(leftBefore);
  });

  it.each([
    [2, false],
    [3, true],
  ])("with %i pieces on a cell, shows a count badge: %s", (count, shown) => {
    const pieces = Array.from({ length: count }, (_, index) =>
      makePiece(`G${index + 1}`, "GREEN", 6, 18),
    );
    const { container } = render(layer(pieces));

    const badge = container.querySelector("[data-stack-count]");
    expect(badge !== null).toBe(shown);
    if (shown) expect(badge?.textContent).toBe(String(count));
  });

  it.each([
    [makePiece("B2", "BLUE", 0, null), "Blue piece 2, in base"],
    [makePiece("R3", "RED", 3, 2), "Red piece 3, on the track"],
    [makePiece("G4", "GREEN", 53, null), "Green piece 4, in the home column"],
    [makePiece("Y1", "YELLOW", 57, null), "Yellow piece 1, home"],
  ])("labels %j for screen readers", (piece, label) => {
    render(layer([piece]));

    expect(screen.getByRole("img", { name: label })).toBeTruthy();
  });

  // NFR-SYS-11: which squares are safe comes from the rules it is given.
  it("says a piece is on a safe square only if the rules say so", () => {
    const { rerender } = render(layer([TRACK_PIECE], [2]));
    expect(screen.getByRole("img", { name: "Red piece 1, on the track, on a safe square" })).toBeTruthy();

    rerender(layer([TRACK_PIECE], [3]));
    expect(screen.getByRole("img", { name: "Red piece 1, on the track" })).toBeTruthy();
  });

  it("refuses a step outside the contract instead of guessing a cell", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(() => render(layer([makePiece("R1", "RED", 99, null)]))).toThrow(RangeError);

    vi.restoreAllMocks();
  });
});
