import { memo, type CSSProperties } from "react";
import { ShapeGlyph } from "@/components/ShapeGlyph";
import {
  BOARD_COLOURS,
  CENTRE_BLOCK_ORIGIN,
  CENTRE_BLOCK_SIZE,
  CENTRE_TRIANGLES,
  HOME_COLUMN_CELLS,
  START_SQUARE,
  TRACK_CELLS,
  YARD_ORIGIN,
  YARD_SIZE,
  YARD_SLOT_SIZE,
  YARD_SLOTS,
  type BoardCell,
} from "@/config/board";
import { homeEntry, isSafeSquare } from "@/config/geometry";
import { PLAYER_IDENTITY } from "@/config/players";
import type { Colour } from "@/contract/types";
import { GAME_TEXT } from "@/feedback/copy";

const STAR_POINTS = "12,2 15,9 22,9.5 17,14.5 18.5,22 12,18 5.5,22 7,14.5 2,9.5 9,9";
const CELL_CLASSES = "flex items-center justify-center border-[0.5px] border-board-line";

const START_COLOUR_BY_SQUARE = new Map<number, Colour>(
  BOARD_COLOURS.map((colour) => [START_SQUARE[colour], colour]),
);

function placeOnGrid([col, row]: BoardCell, span = 1): CSSProperties {
  return { gridColumn: `${col + 1} / span ${span}`, gridRow: `${row + 1} / span ${span}` };
}

function yardPercent(cells: number): string {
  return `${(cells / YARD_SIZE) * 100}%`;
}

function tinted(token: string): string {
  return `color-mix(in srgb, ${token} 55%, var(--board-cell))`;
}

export interface BoardGridProps {
  safeSquares: readonly number[]; // NFR-SYS-11: always snapshot.rules.safeSquares
}

function sameSafeSquares(previous: BoardGridProps, next: BoardGridProps): boolean {
  return (
    previous.safeSquares.length === next.safeSquares.length &&
    previous.safeSquares.every((square, index) => square === next.safeSquares[index])
  );
}

// Every snapshot brings a new array, so this compares the numbers. Otherwise the 100-odd cells
// would redraw on every move although the board never changes during a match.
export const BoardGrid = memo(function BoardGrid({ safeSquares }: BoardGridProps) {
  return (
    <div className="absolute inset-0 grid grid-cols-[repeat(15,minmax(0,1fr))] grid-rows-[repeat(15,minmax(0,1fr))]">
      {BOARD_COLOURS.map((colour) => {
        const { shape, token } = PLAYER_IDENTITY[colour];
        return (
          <div
            key={colour}
            data-yard={colour}
            style={{ ...placeOnGrid(YARD_ORIGIN[colour], YARD_SIZE), backgroundColor: token }}
            className="relative"
          >
            {YARD_SLOTS.map(([col, row]) => (
              <span
                key={`${col}:${row}`}
                data-yard-slot=""
                style={{
                  left: yardPercent(col - YARD_SLOT_SIZE / 2),
                  top: yardPercent(row - YARD_SLOT_SIZE / 2),
                  width: yardPercent(YARD_SLOT_SIZE),
                  height: yardPercent(YARD_SLOT_SIZE),
                }}
                className="absolute flex items-center justify-center rounded-full bg-board-cell text-piece-edge"
              >
                {/* NFR-SYS-07: an empty yard still says whose it is without relying on colour. */}
                <ShapeGlyph shape={shape} className="h-2/5 w-2/5 opacity-30" />
              </span>
            ))}
          </div>
        );
      })}

      {TRACK_CELLS.map((cell, square) => {
        const startColour = START_COLOUR_BY_SQUARE.get(square);
        return (
          <div
            key={square}
            data-square={square}
            style={{
              ...placeOnGrid(cell),
              backgroundColor: startColour && tinted(PLAYER_IDENTITY[startColour].token),
            }}
            className={`${CELL_CLASSES} text-piece-edge ${startColour ? "" : "bg-board-cell"}`}
          >
            {isSafeSquare(square, safeSquares) && (
              <svg
                viewBox="0 0 24 24"
                fill="currentColor"
                role="img"
                aria-label={GAME_TEXT.safeSquare}
                className="h-3/5 w-3/5 opacity-70"
              >
                <polygon points={STAR_POINTS} />
              </svg>
            )}
          </div>
        );
      })}

      {BOARD_COLOURS.flatMap((colour) => {
        const { shape, token } = PLAYER_IDENTITY[colour];
        return HOME_COLUMN_CELLS[colour].map((cell) => (
          <div
            key={`${cell[0]}:${cell[1]}`}
            data-home-column={colour}
            style={{ ...placeOnGrid(cell), backgroundColor: token }}
            className={`${CELL_CLASSES} text-piece-edge`}
          >
            <ShapeGlyph shape={shape} className="h-2/5 w-2/5 opacity-30" />
          </div>
        ));
      })}

      {BOARD_COLOURS.map((colour) => {
        const { cell, degrees } = homeEntry(colour);
        return (
          <div
            key={colour}
            data-entry-arrow={colour}
            style={placeOnGrid(cell)}
            className="flex items-center justify-center text-piece-edge"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              style={{ transform: `rotate(${degrees}deg)` }}
              className="h-1/2 w-1/2 opacity-60"
            >
              <path d="M4 12h15M13 6l6 6-6 6" />
            </svg>
          </div>
        );
      })}

      <svg
        viewBox="0 0 3 3"
        aria-hidden="true"
        data-centre=""
        style={placeOnGrid(CENTRE_BLOCK_ORIGIN, CENTRE_BLOCK_SIZE)}
        className="h-full w-full"
      >
        {BOARD_COLOURS.map((colour) => (
          <polygon
            key={colour}
            points={CENTRE_TRIANGLES[colour]}
            style={{ fill: PLAYER_IDENTITY[colour].token }}
          />
        ))}
      </svg>
    </div>
  );
}, sameSafeSquares);
