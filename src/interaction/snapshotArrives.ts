import type { GameStore } from "@/store/gameStore";

// If an accepted command's snapshot never comes, the screen still has to carry on. The version
// gap is repaired by the store's own sync.
const ARRIVAL_LIMIT_MS = 2000;

/** Resolves once the store holds this version. The contract doesn't say if the ack or state is first. */
export function snapshotArrives(store: GameStore, version: number): Promise<void> {
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
    const limit = setTimeout(finish, ARRIVAL_LIMIT_MS);
    const unsubscribe = store.subscribe(() => {
      if (arrived()) finish();
    });
  });
}
