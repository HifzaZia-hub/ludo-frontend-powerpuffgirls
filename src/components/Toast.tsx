import { useEffect, useRef } from "react";
import { Button } from "@/components/Button";
import { LABELS } from "@/feedback/copy";

export type ToastKind = "info" | "error";

const AUTO_DISMISS_MS = 4000;

export interface ToastProps {
  kind: ToastKind;
  message: string;
  onDismiss: () => void;
}

export function Toast({ kind, message, onDismiss }: ToastProps) {
  // Kept in a ref so a parent re-render doesn't restart the countdown.
  const dismiss = useRef(onDismiss);
  dismiss.current = onDismiss;

  useEffect(() => {
    if (kind === "error") return; // errors stay until the player has read them
    const timer = setTimeout(() => dismiss.current(), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [kind]);

  const isError = kind === "error";

  return (
    <li className="flex items-start gap-3 rounded-lg border border-soft bg-raised p-3 text-[15px] text-high shadow-lg">
      {/* NFR-SYS-07: the symbol, not only its colour, says which kind of message this is. */}
      <span
        aria-hidden="true"
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
          isError ? "bg-danger text-on-danger" : "bg-accent text-on-accent"
        }`}
      >
        {isError ? "!" : "i"}
      </span>
      <p className="flex-1">
        <span className="sr-only">{isError ? LABELS.problem : LABELS.notice}: </span>
        {message}
      </p>
      <Button variant="ghost" size="sm" onClick={onDismiss}>
        {LABELS.dismiss}
      </Button>
    </li>
  );
}
