import { useEffect, useLayoutEffect, useRef } from "react";
import { isTyping } from "@/interaction/useAppNavigation";

const PIECE_KEYS = ["1", "2", "3", "4"];

export interface GameKeys {
  onRoll: () => void;
  onPickNumber: (number: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  onSkip: () => void;
}

// Enter on a button already presses that button, and it must not also send the move.
function isControl(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest("button, a, input, select, textarea") !== null;
}

/** The keys that only mean something during a game (docs/03-ui-spec.md §5). */
export function useGameKeys(keys: GameKeys): void {
  // NFR-SYS-08: one listener, pointed at the newest handlers as the screen is drawn. Replacing the
  // listener happens a moment later, so a key pressed as a control appeared would be lost.
  const latest = useRef(keys);
  useLayoutEffect(() => {
    latest.current = keys;
  });

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      // Ctrl+R has to stay a page reload, and holding a key down must not repeat its action.
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
      // NFR-SYS-08: never take a key while the player is typing or reading a window.
      if (isTyping(event.target) || document.querySelector("dialog[open]")) return;

      const { onRoll, onPickNumber, onConfirm, onCancel, onSkip } = latest.current;
      const key = event.key.toLowerCase();
      if (key === "r") onRoll();
      else if (key === "s") onSkip();
      else if (PIECE_KEYS.includes(key)) onPickNumber(key);
      else if (key === "escape") onCancel();
      else if (key === "enter" && !isControl(event.target)) onConfirm();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
}
