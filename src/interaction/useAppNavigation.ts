import { useEffect } from "react";
import type { GameStore } from "@/store/gameStore";
import { useUiStore } from "@/store/uiStore";

export function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  );
}

/** Moves between screens when the server says so, and adds the keys that work on every screen. */
export function useAppNavigation(store: GameStore): void {
  useEffect(
    () =>
      store.subscribe((state, previous) => {
        const { goTo } = useUiStore.getState();
        if (state.lastEvent !== previous.lastEvent && state.lastEvent?.type === "GAME_STARTED") {
          goTo("game");
        }
        // Leaving, or the server ending the session: either way there is no room to stay in.
        if (previous.room !== null && state.room === null) goTo("main");
      }),
    [store],
  );

  // NFR-SYS-08, docs/03-ui-spec.md §5: never take a key while the player is typing.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "?" || event.ctrlKey || event.metaKey || event.altKey) return;
      if (isTyping(event.target) || document.querySelector("dialog[open]")) return;
      event.preventDefault();
      useUiStore.getState().openModal("rules");
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
}
