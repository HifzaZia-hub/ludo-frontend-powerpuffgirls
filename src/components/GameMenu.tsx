import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/Button";
import { GAME_TEXT } from "@/feedback/copy";

export interface GameMenuProps {
  canRestart: boolean; // the server only accepts a restart from the host
  onRestart: () => void;
  onLeave: () => void;
}

// A button that shows a short list of real buttons. Two choices don't need arrow-key menu behaviour,
// and Tab reaches them like every other control on the screen.
export function GameMenu({ canRestart, onRestart, onLeave }: GameMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    function closeIfOutside(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    }
    document.addEventListener("pointerdown", closeIfOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeIfOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  function choose(action: () => void) {
    // NFR-SYS-08: the button just pressed is about to go, and the dialog returns focus to here.
    triggerRef.current?.focus();
    setOpen(false);
    action();
  }

  const itemClasses = "w-full justify-start whitespace-nowrap";

  return (
    <div ref={rootRef} className="relative">
      <Button
        ref={triggerRef}
        variant="ghost"
        size="sm"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => setOpen((wasOpen) => !wasOpen)}
      >
        {/* U+FE0E asks for the plain glyph, so it takes the theme's text colour. */}
        <span aria-hidden="true">{"☰︎"}</span>
        {GAME_TEXT.menu}
      </Button>
      {open && (
        <div
          id={listId}
          className="absolute left-0 top-full z-40 mt-1 flex flex-col gap-1 rounded-xl border border-soft bg-panel p-2 shadow-lg"
        >
          {canRestart && (
            <Button
              variant="ghost"
              size="sm"
              className={itemClasses}
              onClick={() => choose(onRestart)}
            >
              {GAME_TEXT.restart}
            </Button>
          )}
          <Button variant="ghost" size="sm" className={itemClasses} onClick={() => choose(onLeave)}>
            {GAME_TEXT.leave}
          </Button>
        </div>
      )}
    </div>
  );
}
