// What changed between two accepted snapshots. The contract names no fields for any event (§8), so
// this is the only way to know who moved or who was captured. It describes what the server already
// did and decides nothing about the game.

import { pathSteps } from "@/config/geometry";
import type { GameStateSnapshot, Piece } from "@/contract/types";

export interface PieceChange {
  piece: Piece;
  fromStep: number;
}

/** A piece's route between two snapshots, not counting the square it started on. */
export interface Walk {
  pieceId: string;
  steps: readonly number[];
}

function changes(
  before: GameStateSnapshot,
  after: GameStateSnapshot,
  matches: (step: number, fromStep: number) => boolean,
): PieceChange[] {
  return after.pieces.flatMap((piece) => {
    const was = before.pieces.find(({ id }) => id === piece.id);
    return was && matches(piece.step, was.step) ? [{ piece, fromStep: was.step }] : [];
  });
}

export function piecesMoved(before: GameStateSnapshot, after: GameStateSnapshot): boolean {
  return (
    before.matchId !== after.matchId ||
    changes(before, after, (step, fromStep) => step !== fromStep).length > 0
  );
}

/** The pieces that went forward. A normal change has exactly one. */
export function advancedPieces(before: GameStateSnapshot, after: GameStateSnapshot): PieceChange[] {
  return changes(before, after, (step, fromStep) => step > fromStep);
}

/** The pieces sent backwards, which only a capture does. */
export function capturedPieces(before: GameStateSnapshot, after: GameStateSnapshot): PieceChange[] {
  return changes(before, after, (step, fromStep) => step < fromStep);
}

export function walkBetween(
  before: GameStateSnapshot | null,
  after: GameStateSnapshot | null,
): Walk | null {
  if (!before || !after || before.matchId !== after.matchId) return null;
  // Further apart than one change, a piece may have moved more than once, so there's no one path.
  if (after.version !== before.version + 1) return null;

  const [only, ...others] = advancedPieces(before, after);
  if (!only || others.length > 0) return null;
  return { pieceId: only.piece.id, steps: pathSteps(only.fromStep, only.piece.step) };
}
