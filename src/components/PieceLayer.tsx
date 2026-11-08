import { motion } from "framer-motion";
import { Piece as PieceToken } from "@/components/Piece";
import { STACK_BADGE_MIN } from "@/config/board";
import {
  boardPercent,
  cellKey,
  isSafeSquare,
  pieceCell,
  piecePlace,
  piecePlacement,
  stackOffsets,
  type StackOffset,
} from "@/config/geometry";
import type { Piece } from "@/contract/types";
import { pieceLabel } from "@/feedback/copy";

const ALONE: StackOffset = { dx: 0, dy: 0, scale: 1 };

// How far up and across the count badge sits from the centre of its cell, in cell units.
const BADGE_COL_OFFSET = 0.05;
const BADGE_ROW_OFFSET = -0.5;

export interface PieceLayerProps {
  pieces: readonly Piece[];
  piecesByCell: ReadonlyMap<string, readonly Piece[]>;
  safeSquares: readonly number[]; // NFR-SYS-11: always snapshot.rules.safeSquares
  tweenSeconds: number;
}

// Draws only what the snapshot says (CLAUDE.md §1). Walks over `pieces`, not the cells, so the
// page order never changes and a piece is never re-created, which would make it teleport.
export function PieceLayer({ pieces, piecesByCell, safeSquares, tweenSeconds }: PieceLayerProps) {
  const crowded = [...piecesByCell.values()].filter((stack) => stack.length >= STACK_BADGE_MIN);

  return (
    <div className="absolute inset-0">
      {pieces.map((piece) => {
        const point = pieceCell(piece);
        const stack = piecesByCell.get(cellKey(point)) ?? [piece];
        const offset =
          stackOffsets(stack.length)[stack.findIndex(({ id }) => id === piece.id)] ?? ALONE;
        const { left, top, size } = piecePlacement(point, offset);
        const onSafeSquare =
          piece.boardSquare !== null && isSafeSquare(piece.boardSquare, safeSquares);

        return (
          <motion.div
            key={piece.id}
            data-piece={piece.id}
            layout
            layoutDependency={`${left}:${top}:${size}`}
            transition={{ duration: tweenSeconds }}
            style={{ left: `${left}%`, top: `${top}%`, width: `${size}%`, height: `${size}%` }}
            className="absolute"
          >
            <PieceToken
              colour={piece.colour}
              label={pieceLabel(
                piece.colour,
                piece.id.slice(1),
                piecePlace(piece.step),
                onSafeSquare,
              )}
              className="h-full w-full"
            />
          </motion.div>
        );
      })}

      {crowded.map((stack) => {
        const first = stack[0];
        if (!first) return null;
        const { col, row } = pieceCell(first);
        return (
          // Each piece already has its own label, so this count is only for the eye.
          <span
            key={cellKey({ col, row })}
            aria-hidden="true"
            data-stack-count={stack.length}
            style={{
              left: `${boardPercent(col + BADGE_COL_OFFSET)}%`,
              top: `${boardPercent(row + BADGE_ROW_OFFSET)}%`,
            }}
            className="absolute flex h-4 min-w-4 items-center justify-center rounded-full bg-piece-edge px-1 text-[10px] font-bold text-board-cell"
          >
            {stack.length}
          </span>
        );
      })}
    </div>
  );
}
