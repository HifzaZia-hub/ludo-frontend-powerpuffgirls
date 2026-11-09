import { useCallback, useEffect, useState } from "react";
import { pathSteps } from "@/config/geometry";
import type { GameStateSnapshot } from "@/contract/types";

/** Where to draw a piece that is part way along its walk. */
export interface PieceWalk {
  pieceId: string;
  step: number;
}

interface Walk {
  pieceId: string;
  steps: readonly number[];
}

// Worked out from two accepted snapshots, because the contract names no fields for MOVED (§8).
function walkBetween(before: GameStateSnapshot | null, after: GameStateSnapshot | null): Walk | null {
  if (!before || !after || before.matchId !== after.matchId) return null;
  // Further apart than one change, a piece may have moved more than once, so there's no one path.
  if (after.version !== before.version + 1) return null;

  const walks = after.pieces.flatMap((piece) => {
    const was = before.pieces.find(({ id }) => id === piece.id);
    return was && piece.step > was.step
      ? [{ pieceId: piece.id, steps: pathSteps(was.step, piece.step) }]
      : [];
  });
  return walks.length === 1 ? (walks[0] ?? null) : null;
}

export interface MoveWalk {
  walk: PieceWalk | null;
  /** True after a skip, until the next snapshot: the piece must land at once, without a glide. */
  skipped: boolean;
  skip: () => void;
}

/**
 * FR-SYS-05: a visual offset only. The real position is always the snapshot's, and with no walk
 * running (or animations off, POST-05-2) that is exactly where the piece is drawn.
 */
export function useMoveWalk(snapshot: GameStateSnapshot | null, stepMs: number): MoveWalk {
  const [seen, setSeen] = useState(snapshot);
  const [walk, setWalk] = useState<Walk | null>(null);
  const [skipped, setSkipped] = useState(false);

  // During render, or the piece would be painted at its destination before the walk began.
  // The snapshot always wins: a new one replaces any walk still running.
  if (snapshot !== seen) {
    setSeen(snapshot);
    setWalk(stepMs > 0 ? walkBetween(seen, snapshot) : null);
    setSkipped(false);
  }

  useEffect(() => {
    if (!walk) return;
    const timer = setTimeout(() => {
      setWalk(walk.steps.length > 1 ? { ...walk, steps: walk.steps.slice(1) } : null);
    }, stepMs);
    return () => clearTimeout(timer);
  }, [walk, stepMs]);

  const skip = useCallback(() => {
    setWalk(null);
    setSkipped(true);
  }, []);

  const step = walk?.steps[0];
  return {
    walk: walk && step !== undefined ? { pieceId: walk.pieceId, step } : null,
    skipped,
    skip,
  };
}
