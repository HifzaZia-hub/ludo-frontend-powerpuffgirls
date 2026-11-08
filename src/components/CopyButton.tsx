import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/Button";

const COPIED_MS = 2000;

export interface CopyButtonProps {
  text: string;
  label: string;
  copiedLabel: string;
  failedMessage: string;
  /** Shown in the message line when there is nothing else to say. */
  hint?: string;
}

export function CopyButton({ text, label, copiedLabel, failedMessage, hint }: CopyButtonProps) {
  const [result, setResult] = useState<"copied" | "failed" | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    clearTimeout(timer.current);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      setResult("failed"); // the browser refused, or this page isn't on https or localhost
      return;
    }
    setResult("copied");
    timer.current = setTimeout(() => setResult(null), COPIED_MS);
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <Button variant="outline" size="sm" onClick={() => void copy()}>
        {result === "copied" ? copiedLabel : label}
      </Button>
      {/* The space is kept so a message doesn't push the page down. */}
      <p role="status" className="min-h-[1.5rem] text-[15px] text-mid">
        {result === "copied" && <span className="sr-only">{copiedLabel}</span>}
        {result === "failed" ? failedMessage : hint}
      </p>
    </div>
  );
}
