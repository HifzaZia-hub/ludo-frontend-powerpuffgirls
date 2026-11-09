import { useCallback, useRef, useState } from "react";
import { snapshotArrives } from "@/interaction/snapshotArrives";
import { selectCanRoll, type GameStore } from "@/store/gameStore";

export interface DiceRoll {
  rolling: boolean;
  roll: () => void;
  /** D2 FR-38: drops the rest of the tumble. The die still waits for the server's value. */
  skip: () => void;
}

/** Sends a roll and keeps the die tumbling until it can land on the server's value. */
export function useDiceRoll(store: GameStore, tumbleMs: number): DiceRoll {
  const [rolling, setRolling] = useState(false);
  // FR-SYS-02 EXC-02-1: a second press can arrive before React has redrawn the die.
  const inFlight = useRef(false);
  const endTumble = useRef<() => void>(() => undefined);

  const roll = useCallback(() => {
    if (inFlight.current || !selectCanRoll(store.getState())) return;
    inFlight.current = true;
    setRolling(true); // NFR-SYS-01: the die reacts before the server has answered

    async function tumble() {
      const shortestTumble = new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, tumbleMs);
        endTumble.current = () => {
          clearTimeout(timer);
          resolve();
        };
      });
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

  const skip = useCallback(() => endTumble.current(), []);

  return { rolling, roll, skip };
}
