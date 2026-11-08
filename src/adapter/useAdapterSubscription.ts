import { useEffect } from "react";
import type { GameStore } from "@/store/gameStore";

// Takes the store, not the adapter, because components never touch the adapter (CLAUDE.md §3).
// The store's applyConnection does the resync after a reconnect, so that rule can be tested
// without React.
export function useAdapterSubscription(store: GameStore): void {
  useEffect(() => store.getState().listen(), [store]);
}
