// NFR-SYS-11: the board's layout lives here in config, never in components.
// Layout only, no game rules. TRACK_CELLS, HOME_COLUMN_CELLS, START_SQUARE, YARD_ORIGIN and
// YARD_SLOTS are copied exactly from docs/02-board-model.md, where they were verified.

import type { Colour } from "@/contract/types";

/** A board cell as [col, row], zero-indexed from the top-left of the 15x15 grid. */
export type BoardCell = readonly [number, number];

// index = main-track square number (0..51)
// prettier-ignore
export const TRACK_CELLS: ReadonlyArray<BoardCell> = [
  [1,6], [2,6], [3,6], [4,6],    // 0-3
  [5,6], [6,5], [6,4], [6,3],    // 4-7
  [6,2], [6,1], [6,0], [7,0],    // 8-11
  [8,0], [8,1], [8,2], [8,3],    // 12-15
  [8,4], [8,5], [9,6], [10,6],   // 16-19
  [11,6],[12,6],[13,6],[14,6],   // 20-23
  [14,7],[14,8],[13,8],[12,8],   // 24-27
  [11,8],[10,8],[9,8], [8,9],    // 28-31
  [8,10],[8,11],[8,12],[8,13],   // 32-35
  [8,14],[7,14],[6,14],[6,13],   // 36-39
  [6,12],[6,11],[6,10],[6,9],    // 40-43
  [5,8], [4,8], [3,8], [2,8],    // 44-47
  [1,8], [0,8], [0,7], [0,6],    // 48-51
] as const;

// Steps 52 to 56, in travel order.
// prettier-ignore
export const HOME_COLUMN_CELLS: Record<Colour, ReadonlyArray<BoardCell>> = {
  RED:    [[1,7], [2,7], [3,7], [4,7], [5,7]],      // enters from the left
  GREEN:  [[7,1], [7,2], [7,3], [7,4], [7,5]],      // enters from the top
  YELLOW: [[13,7],[12,7],[11,7],[10,7],[9,7]],      // enters from the right
  BLUE:   [[7,13],[7,12],[7,11],[7,10],[7,9]],      // enters from the bottom
};

export const START_SQUARE: Record<Colour, number> = { RED: 0, GREEN: 13, YELLOW: 26, BLUE: 39 };

export const YARD_ORIGIN: Record<Colour, BoardCell> = {
  RED: [0, 0],
  GREEN: [9, 0],
  YELLOW: [9, 9],
  BLUE: [0, 9],
};

// Fractional cell offsets from the yard origin. Piece 1 uses the first slot and so on, so a
// captured piece always goes back to the same spot.
export const YARD_SLOTS = [
  [1.5, 1.5],
  [4.5, 1.5],
  [1.5, 4.5],
  [4.5, 4.5],
] as const;

export const CENTRE_CELL: BoardCell = [7, 7];

/** Clockwise from the top-left corner (docs/02-board-model.md §2). */
export const BOARD_COLOURS: readonly Colour[] = ["RED", "GREEN", "YELLOW", "BLUE"];

/** Cells along one side of the board. */
export const BOARD_SIZE = 15;
export const YARD_SIZE = 6;
/** How wide the circle under a yard piece is, in cell units. */
export const YARD_SLOT_SIZE = 1.5;
/** How wide a piece alone on its cell is, in cell units. */
export const PIECE_SIZE = 0.8;

export const LAST_TRACK_STEP = 51;
export const FIRST_HOME_COLUMN_STEP = 52;

export const CENTRE_BLOCK_ORIGIN: BoardCell = [6, 6];
export const CENTRE_BLOCK_SIZE = 3;

// Each colour's triangle in the centre, on the side its home column arrives from. On a 3x3 grid.
export const CENTRE_TRIANGLES: Record<Colour, string> = {
  RED: "0,0 1.5,1.5 0,3",
  GREEN: "0,0 3,0 1.5,1.5",
  YELLOW: "3,0 3,3 1.5,1.5",
  BLUE: "0,3 1.5,1.5 3,3",
};

// How pieces sharing a cell fan out (docs/02-board-model.md §5), in cell units.
export const STACK_OFFSET = 0.18;
export const STACK_SCALE_STEP = 0.08;
// A safe square can in theory hold all 16 pieces, and the scale formula goes negative past 13.
export const STACK_MIN_SCALE = 0.4;
/** From this many pieces on one cell, a badge shows the count (docs/02-board-model.md §5). */
export const STACK_BADGE_MIN = 3;
