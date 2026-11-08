import { useEffect } from "react";
import { isTyping } from "@/interaction/useAppNavigation";

/** The keys that only mean something during a game (docs/03-ui-spec.md §5). */
export function useGameKeys(onRoll: () => void): void {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== "r") return;
      // Ctrl+R has to stay a page reload, and holding the key down must not roll again.
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
      // NFR-SYS-08: never take a key while the player is typing or reading a window.
      if (isTyping(event.target) || document.querySelector("dialog[open]")) return;
      onRoll();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onRoll]);
}
