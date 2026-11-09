import { useCallback, useEffect, useState } from "react";
import type { GameStateSnapshot } from "@/contract/types";
import { piecesMoved, walkBetween, type Walk } from "@/feedback/snapshotChanges";

/** Where to draw a piece that is part way along its walk. */
export interface PieceWalk {
  pieceId: string;
  step: number;
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
  if (snapshot !== seen) {
    setSeen(snapshot);
    setSkipped(false);
    // The snapshot always wins when it moves a piece. One that doesn't, like the next roll, leaves
    // every piece where the walk is heading, and stopping for it would cut captures short.
    if (!seen || !snapshot || piecesMoved(seen, snapshot)) {
      setWalk(stepMs > 0 ? walkBetween(seen, snapshot) : null);
    }
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
