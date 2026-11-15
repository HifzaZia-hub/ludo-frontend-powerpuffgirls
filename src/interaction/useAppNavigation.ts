import { useEffect } from "react";
import type { GameState, GameStore } from "@/store/gameStore";
import { useUiStore, type Screen } from "@/store/uiStore";

export function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  );
}

// Contract §8: a restart of a running match sends GAME_ABANDONED just before GAME_RESTARTED. Waiting
// this long means restarting never flashes "This game was stopped".
export const ABANDON_WAIT_MS = 500;

// After a refresh, the server's first messages say where the player belongs. Null means keep waiting.
function afterRejoining(state: GameState): Screen | null {
  const { snapshot, room, myPlayerId, connection, sessionReplaced } = state;
  if (sessionReplaced) return null;
  if (myPlayerId === null || connection === "lost") return "main";
  if (snapshot) {
    if (snapshot.status === "CLOSED") return "stopped";
    return snapshot.status === "FINISHED" ? "win" : "game";
  }
  return room?.status === "LOBBY" ? "lobby" : null;
}

/** Moves between screens when the server says so, and adds the keys that work on every screen. */
export function useAppNavigation(store: GameStore): void {
  useEffect(() => {
    let abandoned: ReturnType<typeof setTimeout> | undefined;
    const stayed = () => clearTimeout(abandoned);

    const unsubscribe = store.subscribe((state, previous) => {
      const { goTo, screen } = useUiStore.getState();
      const event = state.lastEvent !== previous.lastEvent ? state.lastEvent : null;

      if (screen === "rejoining") {
        const destination = afterRejoining(state);
        if (destination) goTo(destination);
        return;
      }

      if (event?.type === "GAME_ABANDONED") {
        stayed();
        abandoned = setTimeout(() => goTo("stopped"), ABANDON_WAIT_MS);
      }
      if (event?.type === "GAME_RESTARTED") stayed();
      // With a snapshot already here this is a restart, handled when the new match arrives below.
      if (event?.type === "GAME_STARTED") {
        stayed();
        if (state.snapshot === null) goTo("game");
      }
      // FR-SYS-08: waiting for the new match means no piece from the old one is ever drawn.
      if (
        state.snapshot !== null &&
        previous.snapshot !== null &&
        state.snapshot.matchId !== previous.snapshot.matchId
      ) {
        stayed();
        goTo("game");
      }
      // Leaving, or the server ending the session: either way there is no room to stay in.
      if (previous.room !== null && state.room === null) {
        stayed();
        goTo("main");
      }
    });

    return () => {
      stayed();
      unsubscribe();
    };
  }, [store]);

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
