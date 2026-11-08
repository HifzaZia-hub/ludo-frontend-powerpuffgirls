import { useCallback, useRef, useState } from "react";
import { selectCanRoll, type GameStore } from "@/store/gameStore";

// If an accepted roll's snapshot never comes, the die still has to stop. The version gap is
// repaired by the store's own sync.
const LANDING_LIMIT_MS = 2000;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function snapshotArrives(store: GameStore, version: number): Promise<void> {
  return new Promise((resolve) => {
    const arrived = () => (store.getState().snapshot?.version ?? 0) >= version;
    if (arrived()) {
      resolve();
      return;
    }
    const finish = () => {
      clearTimeout(limit);
      unsubscribe();
      resolve();
    };
    const limit = setTimeout(finish, LANDING_LIMIT_MS);
    const unsubscribe = store.subscribe(() => {
      if (arrived()) finish();
    });
  });
}

export interface DiceRoll {
  rolling: boolean;
  roll: () => void;
}

/** Sends a roll and keeps the die tumbling until it can land on the server's value. */
export function useDiceRoll(store: GameStore, tumbleMs: number): DiceRoll {
  const [rolling, setRolling] = useState(false);
  // FR-SYS-02 EXC-02-1: a second press can arrive before React has redrawn the die.
  const inFlight = useRef(false);

  const roll = useCallback(() => {
    if (inFlight.current || !selectCanRoll(store.getState())) return;
    inFlight.current = true;
    setRolling(true); // NFR-SYS-01: the die reacts before the server has answered

    async function tumble() {
      const shortestTumble = wait(tumbleMs);
      const version = await store.getState().roll();
      // POST-02-2: the contract doesn't say whether the reply or the new state comes first, so
      // wait for the state. Otherwise the die could land on the previous roll.
      // EXC-02-2: a failed roll has no new state to wait for, so it stops at once.
      if (version !== null) await Promise.all([shortestTumble, snapshotArrives(store, version)]);
      inFlight.current = false;
      setRolling(false);
    }

    void tumble();
  }, [store, tumbleMs]);

  return { rolling, roll };
}
