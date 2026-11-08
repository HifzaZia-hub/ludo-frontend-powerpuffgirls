// The computer players. Also used as the stand-in when a human disconnects or runs out of time.

import type { Difficulty, LegalMove } from "../src/contract/types";
import { activePlayer, boardSquareFor, drawInt, HOME_STEP, YARD_STEP, type Match } from "./game";

export function scoreMove(match: Match, move: LegalMove): number {
  const square = boardSquareFor(activePlayer(match).colour, move.toStep);
  let score = 0;
  if (move.toStep === HOME_STEP) score += 100;
  if (move.captures.length > 0) score += 80;
  if (move.fromStep === YARD_STEP) score += 60;
  if (square !== null && match.rules.safeSquares.includes(square)) score += 40;
  // Plain moves only: this nudges the computer to bring its furthest piece along.
  return score > 0 ? score : move.toStep / 10;
}

function bestMove(match: Match, moves: LegalMove[]): LegalMove | undefined {
  let best: LegalMove | undefined;
  let bestScore = -1;
  for (const move of moves) {
    const score = scoreMove(match, move);
    // Leaving the yard onto a safe square also scores 100, so finishing must win that tie.
    if (score > bestScore || (score === bestScore && best && move.toStep > best.toStep)) {
      best = move;
      bestScore = score;
    }
  }
  return best;
}

export function chooseMove(match: Match, difficulty: Difficulty): LegalMove {
  const moves = match.turn.legalMoves;
  const choice =
    difficulty === "EASY" ? moves[drawInt(match, moves.length)] : bestMove(match, moves);
  if (!choice) throw new Error("The computer was asked to move with no legal moves");
  return choice;
}
