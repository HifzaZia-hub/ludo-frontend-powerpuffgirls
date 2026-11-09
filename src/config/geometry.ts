// Pure layout maths (docs/02-board-model.md): turns what a snapshot says into screen positions.
// Nothing here decides anything about the game (CLAUDE.md §1).

import {
  BOARD_SIZE,
  CENTRE_CELL,
  FIRST_HOME_COLUMN_STEP,
  HOME_COLUMN_CELLS,
  LAST_TRACK_STEP,
  PIECE_SIZE,
  STACK_MIN_SCALE,
  STACK_OFFSET,
  STACK_SCALE_STEP,
  START_SQUARE,
  TRACK_CELLS,
  YARD_ORIGIN,
  YARD_SLOTS,
  type BoardCell,
} from "@/config/board";
import type { Colour, Piece } from "@/contract/types";

/** A position in grid units (0..15). */
export interface GridPoint {
  col: number;
  row: number;
}

/** How far to shift and shrink one piece in a stack, in cell units. */
export interface StackOffset {
  dx: number;
  dy: number;
  scale: number;
}

function cellCentre(cell: BoardCell | undefined, piece: Piece): GridPoint {
  // A missing cell means a step outside the contract's range. Failing loudly is better than
  // drawing a piece somewhere no snapshot put it.
  if (!cell) throw new RangeError(`No board cell for piece ${piece.id} at step ${piece.step}`);
  return { col: cell[0] + 0.5, row: cell[1] + 0.5 };
}

/** The main-track square for a step, or null when the step is not on the main track. */
export function squareForStep(colour: Colour, step: number): number | null {
  if (!Number.isInteger(step) || step < 1 || step > 51) return null;
  return (START_SQUARE[colour] + step - 1) % TRACK_CELLS.length;
}

/** A piece's number on screen: "R3" is piece 3. */
export function pieceNumber(pieceId: string): string {
  return pieceId.slice(1);
}

/** Centre of the cell a piece sits on, in grid units. */
export function pieceCell(piece: Piece): GridPoint {
  const { colour, step, id } = piece;

  if (step === 0) {
    const [originCol, originRow] = YARD_ORIGIN[colour];
    const slot = YARD_SLOTS[Number(pieceNumber(id)) - 1];
    if (!slot) throw new RangeError(`No yard slot for piece ${id}`);
    return { col: originCol + slot[0], row: originRow + slot[1] };
  }

  if (step === 57) return cellCentre(CENTRE_CELL, piece);
  if (step >= 52) return cellCentre(HOME_COLUMN_CELLS[colour][step - 52], piece);

  const square = squareForStep(colour, step);
  return cellCentre(square === null ? undefined : TRACK_CELLS[square], piece);
}

/** A name for a position, so pieces on the same spot can be grouped. */
export function cellKey(point: GridPoint): string {
  return `${point.col}:${point.row}`;
}

/** A distance in cell units, as a percentage of the board's side. */
export function boardPercent(cells: number): number {
  return (cells / BOARD_SIZE) * 100;
}

/** Where one piece goes, as percentages of the board. */
export interface PiecePlacement {
  left: number;
  top: number;
  size: number;
}

// Left and top rather than a centring transform, because Framer Motion's layout animation
// writes its own transform on the same element.
export function piecePlacement(point: GridPoint, offset: StackOffset): PiecePlacement {
  const width = PIECE_SIZE * offset.scale;
  return {
    left: boardPercent(point.col + offset.dx - width / 2),
    top: boardPercent(point.row + offset.dy - width / 2),
    size: boardPercent(width),
  };
}

export type PiecePlace = "base" | "track" | "homeColumn" | "home";

/** Names the part of the board a step is on, for labels. Decides nothing about the game. */
export function piecePlace(step: number): PiecePlace {
  if (step === 0) return "base";
  if (step === 57) return "home";
  return step >= FIRST_HOME_COLUMN_STEP ? "homeColumn" : "track";
}

function pointOnStep(colour: Colour, step: number): GridPoint {
  return pieceCell({ id: "", colour, step, boardSquare: null });
}

/** The last track cell before a colour's home column, and which way the column lies. */
export function homeEntry(colour: Colour): { cell: BoardCell; degrees: number } {
  const from = pointOnStep(colour, LAST_TRACK_STEP);
  const into = pointOnStep(colour, FIRST_HOME_COLUMN_STEP);
  return {
    cell: [from.col - 0.5, from.row - 0.5],
    degrees: (Math.atan2(into.row - from.row, into.col - from.col) * 180) / Math.PI,
  };
}

/** The steps a piece passes through for animation, including the destination. */
export function pathSteps(fromStep: number, toStep: number): number[] {
  if (fromStep === 0) return [1]; // leaving the yard is one hop
  const steps: number[] = [];
  for (let step = fromStep + 1; step <= toStep; step++) steps.push(step);
  return steps;
}

// NFR-SYS-11: the caller passes rules.safeSquares, because the host can change the list.
export function isSafeSquare(square: number, safeSquares: readonly number[]): boolean {
  return safeSquares.includes(square);
}

/** One offset per piece sharing a cell, fanned left to right over a small arc. */
export function stackOffsets(count: number): StackOffset[] {
  if (count === 1) return [{ dx: 0, dy: 0, scale: 1 }];

  const scale = Math.max(STACK_MIN_SCALE, 1 - STACK_SCALE_STEP * (count - 1));
  return Array.from({ length: count }, (_, index) => {
    // The top half of a circle. Row numbers grow downwards, so a negative dy is upwards.
    const angle = Math.PI + (Math.PI * index) / (count - 1);
    return { dx: STACK_OFFSET * Math.cos(angle), dy: STACK_OFFSET * Math.sin(angle), scale };
  });
}

// FR-SYS-06: counts what the snapshot already says. The home column counts as track.
export function progressCounts(pieces: readonly Piece[], colour: Colour) {
  const mine = pieces.filter((piece) => piece.colour === colour);
  return {
    base: mine.filter((piece) => piece.step === 0).length,
    track: mine.filter((piece) => piece.step >= 1 && piece.step <= 56).length,
    home: mine.filter((piece) => piece.step === 57).length,
  };
}
