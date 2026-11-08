import { HOME_COLUMN_CELLS, TRACK_CELLS, type BoardCell } from "@/config/board";
import {
  isSafeSquare,
  pathSteps,
  pieceCell,
  progressCounts,
  squareForStep,
  stackOffsets,
  type GridPoint,
} from "@/config/geometry";
import type { Colour, Piece } from "@/contract/types";

const COLOURS: Colour[] = ["RED", "GREEN", "YELLOW", "BLUE"];

function makePiece(colour: Colour, step: number, number = 1): Piece {
  return { id: `${colour.charAt(0)}${number}`, colour, step, boardSquare: null };
}

function cellKey(cell: BoardCell): string {
  return cell.join(",");
}

function isOrthogonallyAdjacent(a: GridPoint, b: GridPoint): boolean {
  return Math.abs(a.col - b.col) + Math.abs(a.row - b.row) === 1;
}

describe("board cells", () => {
  it("has 52 track cells with no duplicates", () => {
    expect(TRACK_CELLS).toHaveLength(52);
    expect(new Set(TRACK_CELLS.map(cellKey)).size).toBe(52);
  });

  it("never puts a track cell on a home column or the centre", () => {
    const track = new Set(TRACK_CELLS.map(cellKey));
    const homeColumns = COLOURS.flatMap((colour) => HOME_COLUMN_CELLS[colour]).map(cellKey);

    expect(homeColumns).toHaveLength(20);
    expect(homeColumns.filter((cell) => track.has(cell))).toEqual([]);
    expect(track.has("7,7")).toBe(false);
  });
});

describe("pieceCell", () => {
  it.each<[Colour, number, number]>([
    ["RED", 1, 6],
    ["GREEN", 8, 1],
    ["YELLOW", 13, 8],
    ["BLUE", 6, 13],
  ])("puts step 1 of %s on cell [%i,%i]", (colour, col, row) => {
    expect(pieceCell(makePiece(colour, 1))).toEqual({ col: col + 0.5, row: row + 0.5 });
  });

  it.each(COLOURS)("puts step 51 of %s right next to its home column", (colour) => {
    const lastTrackCell = pieceCell(makePiece(colour, 51));
    const firstHomeCell = pieceCell(makePiece(colour, 52));

    expect(isOrthogonallyAdjacent(lastTrackCell, firstHomeCell)).toBe(true);
  });

  it.each(COLOURS)("walks %s up its home column in travel order", (colour) => {
    const cells = [52, 53, 54, 55, 56].map((step) => pieceCell(makePiece(colour, step)));
    const expected = HOME_COLUMN_CELLS[colour].map(([col, row]) => ({
      col: col + 0.5,
      row: row + 0.5,
    }));

    expect(cells).toEqual(expected);
  });

  it.each<[Colour, number, number]>([
    ["RED", 0, 0],
    ["GREEN", 9, 0],
    ["YELLOW", 9, 9],
    ["BLUE", 0, 9],
  ])("gives each %s piece its own yard slot", (colour, originCol, originRow) => {
    const slots = [1, 2, 3, 4].map((number) => pieceCell(makePiece(colour, 0, number)));

    expect(slots).toEqual([
      { col: originCol + 1.5, row: originRow + 1.5 },
      { col: originCol + 3.5, row: originRow + 1.5 },
      { col: originCol + 1.5, row: originRow + 3.5 },
      { col: originCol + 3.5, row: originRow + 3.5 },
    ]);
  });

  it.each(COLOURS)("puts a finished %s piece in the centre", (colour) => {
    expect(pieceCell(makePiece(colour, 57))).toEqual({ col: 7.5, row: 7.5 });
  });

  it.each([-1, 58, 1.5])("refuses step %d instead of guessing a cell", (step) => {
    expect(() => pieceCell(makePiece("GREEN", step))).toThrow(RangeError);
  });

  it("refuses a yard piece with a bad ID", () => {
    expect(() => pieceCell(makePiece("RED", 0, 5))).toThrow(RangeError);
  });
});

describe("squareForStep", () => {
  it.each<[Colour, number, number]>([
    ["RED", 0, 50],
    ["GREEN", 13, 11],
    ["YELLOW", 26, 24],
    ["BLUE", 39, 37],
  ])("maps steps 1 and 51 of %s to squares %i and %i", (colour, first, last) => {
    expect(squareForStep(colour, 1)).toBe(first);
    expect(squareForStep(colour, 51)).toBe(last);
  });

  it.each([0, 52, 56, 57])("returns null for step %i, which is off the main track", (step) => {
    expect(squareForStep("RED", step)).toBeNull();
  });
});

describe("pathSteps", () => {
  it("makes leaving the yard one hop", () => {
    expect(pathSteps(0, 1)).toEqual([1]);
  });

  it("lists every step up to and including the destination", () => {
    expect(pathSteps(10, 16)).toEqual([11, 12, 13, 14, 15, 16]);
  });
});

describe("isSafeSquare", () => {
  it("only trusts the list it is given", () => {
    expect(isSafeSquare(5, [5])).toBe(true);
    expect(isSafeSquare(0, [5])).toBe(false);
  });
});

describe("stackOffsets", () => {
  it("leaves a single piece alone", () => {
    expect(stackOffsets(1)).toEqual([{ dx: 0, dy: 0, scale: 1 }]);
  });

  it.each([2, 3, 4])("fans out %i pieces without overlapping them", (count) => {
    const offsets = stackOffsets(count);
    const positions = offsets.map(({ dx, dy }) => `${dx.toFixed(3)},${dy.toFixed(3)}`);

    expect(offsets).toHaveLength(count);
    expect(new Set(positions).size).toBe(count);
    for (const { dx, dy, scale } of offsets) {
      expect(Math.abs(dx)).toBeLessThanOrEqual(0.18 + 1e-9);
      expect(Math.abs(dy)).toBeLessThanOrEqual(0.18 + 1e-9);
      expect(scale).toBeCloseTo(1 - 0.08 * (count - 1));
    }
  });

  it("never shrinks a huge stack to nothing", () => {
    expect(stackOffsets(16).every(({ scale }) => scale > 0)).toBe(true);
  });
});

describe("progressCounts", () => {
  it("counts base, track and home for one colour only", () => {
    const pieces = [
      makePiece("RED", 0, 1),
      makePiece("RED", 3, 2),
      makePiece("RED", 54, 3),
      makePiece("RED", 57, 4),
      makePiece("BLUE", 57, 1),
    ];

    expect(progressCounts(pieces, "RED")).toEqual({ base: 1, track: 2, home: 1 });
  });
});
