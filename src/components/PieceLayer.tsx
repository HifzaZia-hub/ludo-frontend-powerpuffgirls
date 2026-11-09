import { motion, type Transition } from "framer-motion";
import { Piece as PieceToken, type PieceEffect, type PieceState } from "@/components/Piece";
import { STACK_BADGE_MIN } from "@/config/board";
import {
  boardPercent,
  cellKey,
  isSafeSquare,
  pieceCell,
  pieceNumber,
  piecePlace,
  piecePlacement,
  stackOffsets,
  type StackOffset,
} from "@/config/geometry";
import type { LegalMove, Piece } from "@/contract/types";
import { GAME_TEXT, movablePieceLabel, pieceLabel } from "@/feedback/copy";

const ALONE: StackOffset = { dx: 0, dy: 0, scale: 1 };

// How far up and across the count badge sits from the centre of its cell, in cell units.
const BADGE_COL_OFFSET = 0.05;
const BADGE_ROW_OFFSET = -0.5;

export interface PieceChoiceMove extends LegalMove {
  phrase: string;
}

/** FR-SYS-03: the moves on offer. Absent whenever the player has nothing to choose. */
export interface PieceChoice {
  moves: readonly PieceChoiceMove[];
  selected: PieceChoiceMove | null;
  locked: boolean;
  onPick: (pieceId: string) => void;
  onPreview: (pieceId: string) => void;
}

/** FR-SYS-05: what the event queue is showing. Visual only, like a walk. */
export interface PieceEffects {
  held: ReadonlyMap<string, number>;
  flashingId: string | null;
  returningId: string | null;
  finishingId: string | null;
  returnSeconds: number;
}

export interface PieceLayerProps {
  pieces: readonly Piece[];
  piecesByCell: ReadonlyMap<string, readonly Piece[]>;
  safeSquares: readonly number[]; // NFR-SYS-11: always snapshot.rules.safeSquares
  tweenSeconds: number;
  choice?: PieceChoice | null;
  walk?: { pieceId: string; step: number } | null;
  walkSeconds?: number;
  effects?: PieceEffects | null;
}

function pieceState(piece: Piece, choice: PieceChoice | null): PieceState {
  if (!choice) return "idle";
  if (piece.id === choice.selected?.pieceId) return "selected";
  if (choice.selected?.captures.includes(piece.id)) return "target";
  return choice.moves.some((move) => move.pieceId === piece.id) ? "movable" : "dimmed";
}

// Draws only what the snapshot says (CLAUDE.md §1). Walks over `pieces`, not the cells, so the
// page order never changes and a piece is never re-created, which would make it teleport.
export function PieceLayer({
  pieces,
  piecesByCell,
  safeSquares,
  tweenSeconds,
  choice = null,
  walk = null,
  walkSeconds = 0,
  effects = null,
}: PieceLayerProps) {
  const crowded = [...piecesByCell.values()].filter((stack) => stack.length >= STACK_BADGE_MIN);

  const selectedMove = choice?.selected ?? null;
  const selectedPiece = pieces.find(({ id }) => id === selectedMove?.pieceId);
  // FR-18: the server's own toStep. The client never works out where a piece would land.
  const destination =
    selectedMove && selectedPiece
      ? piecePlacement(pieceCell({ ...selectedPiece, step: selectedMove.toStep }), ALONE)
      : null;

  return (
    <div className="absolute inset-0">
      {destination && selectedPiece && (
        <div
          aria-hidden="true"
          data-destination=""
          style={{
            left: `${destination.left}%`,
            top: `${destination.top}%`,
            width: `${destination.size}%`,
            height: `${destination.size}%`,
          }}
          className="absolute rounded-full outline-dashed outline-2 outline-offset-1 outline-piece-edge"
        >
          <PieceToken colour={selectedPiece.colour} label="" className="h-full w-full opacity-50" />
        </div>
      )}

      {pieces.map((piece) => {
        const walking = walk?.pieceId === piece.id;
        const heldStep = effects?.held.get(piece.id);
        let shownStep = piece.step;
        if (heldStep !== undefined) shownStep = heldStep;
        if (walking) shownStep = walk.step;
        const point = pieceCell({ ...piece, step: shownStep });
        const flashing = effects?.flashingId === piece.id;
        const returning = effects?.returningId === piece.id;

        let effect: PieceEffect | null = null;
        if (flashing) effect = "capture";
        else if (effects?.finishingId === piece.id) effect = "finish";

        let transition: Transition = { duration: tweenSeconds };
        if (walking) transition = { duration: walkSeconds, ease: "linear" };
        else if (returning) transition = { duration: effects?.returnSeconds ?? tweenSeconds };
        const stack = piecesByCell.get(cellKey(point)) ?? [piece];
        const offset =
          stackOffsets(stack.length)[stack.findIndex(({ id }) => id === piece.id)] ?? ALONE;
        const { left, top, size } = piecePlacement(point, offset);
        const onSafeSquare =
          piece.boardSquare !== null && isSafeSquare(piece.boardSquare, safeSquares);

        const description = pieceLabel(
          piece.colour,
          pieceNumber(piece.id),
          piecePlace(piece.step),
          onSafeSquare,
        );
        const move = choice?.moves.find(({ pieceId }) => pieceId === piece.id);
        const state = pieceState(piece, choice);
        let label = description;
        if (move) label = movablePieceLabel(description, move.phrase);
        else if (state === "target") label = `${description}, ${GAME_TEXT.wouldBeCaptured}`;

        return (
          <motion.div
            key={piece.id}
            data-piece={piece.id}
            layout
            layoutDependency={`${left}:${top}:${size}`}
            transition={transition}
            style={{ left: `${left}%`, top: `${top}%`, width: `${size}%`, height: `${size}%` }}
            // FR-SYS-03: in a stack, a piece that can't move must never cover one that can.
            className={`absolute ${walking || flashing || returning ? "z-10" : move ? "z-[5]" : ""}`}
          >
            <PieceToken
              colour={piece.colour}
              state={state}
              effect={effect}
              label={label}
              disabled={choice?.locked}
              onSelect={() => choice?.onPick(piece.id)}
              onPreview={() => choice?.onPreview(piece.id)}
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
