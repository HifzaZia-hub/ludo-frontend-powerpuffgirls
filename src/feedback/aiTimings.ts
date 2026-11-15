// NFR-SYS-02: dev only, so main.tsx imports this behind a DEV check. It logs how long each
// computer turn took, so one full game gives the numbers the requirement asks for. A turn runs from
// the snapshot that asks a computer to roll to the next snapshot that waits for a roll, which is
// when its move has arrived. It reads snapshots and decides nothing.

import type { GameStateSnapshot } from "@/contract/types";
import type { GameStore } from "@/store/gameStore";

/** Every line starts with this, so a script can pick the timings out of the console. */
export const TIMING_TAG = "[NFR-SYS-02]";

interface Timing {
  name: string;
  matchId: string;
  version: number;
  startedAt: number;
}

function computerAskedToRoll(snapshot: GameStateSnapshot): string | null {
  if (snapshot.status !== "IN_PROGRESS" || snapshot.turn.phase !== "AWAITING_ROLL") return null;
  const active = snapshot.players.find(({ id }) => id === snapshot.turn.activePlayerId);
  return active?.isAi === true ? active.name : null;
}

export function logComputerTurns(
  store: GameStore,
  log: (line: string) => void = (line) => console.info(line),
  now: () => number = () => performance.now(),
): () => void {
  let timing: Timing | null = null;

  return store.subscribe(({ snapshot }, previous) => {
    if (snapshot === null || snapshot === previous.snapshot) return;
    // A restart begins a new match, so a turn from the old one can't be finished.
    if (timing !== null && timing.matchId !== snapshot.matchId) timing = null;

    const waitingForRoll =
      snapshot.turn.phase === "AWAITING_ROLL" || snapshot.status !== "IN_PROGRESS";
    if (timing !== null && waitingForRoll && snapshot.version > timing.version) {
      log(`${TIMING_TAG} ${timing.name}'s turn took ${Math.round(now() - timing.startedAt)} ms`);
      timing = null;
    }

    const name = computerAskedToRoll(snapshot);
    if (timing === null && name !== null) {
      timing = { name, matchId: snapshot.matchId, version: snapshot.version, startedAt: now() };
    }
  });
}
