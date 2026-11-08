import { useEffect, useState } from "react";
import { secondsLeftLabel } from "@/feedback/copy";

const RADIUS = 20;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function urgencyClass(seconds: number): string {
  if (seconds < 5) return "text-danger";
  return seconds < 10 ? "text-warning" : "text-accent";
}

export interface CountdownRingProps {
  /** Null when the turn has no time limit. Keep this function stable between renders. */
  getSecondsLeft: () => number | null;
  totalSeconds: number;
  /** Shown under the ring at zero. Null keeps its space empty; leave it out for no space at all. */
  zeroMessage?: string | null;
}

// It ticks on its own, so only this ring redraws each second and not the whole game screen.
export function CountdownRing({ getSecondsLeft, totalSeconds, zeroMessage }: CountdownRingProps) {
  const [secondsLeft, setSecondsLeft] = useState(getSecondsLeft);

  useEffect(() => {
    setSecondsLeft(getSecondsLeft());
    const timer = setInterval(() => setSecondsLeft(getSecondsLeft()), 1000);
    return () => clearInterval(timer);
  }, [getSecondsLeft]);

  const fraction =
    secondsLeft !== null && totalSeconds > 0 ? Math.min(secondsLeft / totalSeconds, 1) : 0;

  // The box stays the same size with no timer, so nothing shifts when a turn starts.
  const ring =
    secondsLeft === null ? (
      <span className="inline-block h-14 w-14" />
    ) : (
      <span
        role="timer"
        aria-label={secondsLeftLabel(secondsLeft)}
        className={`relative inline-flex h-14 w-14 items-center justify-center ${urgencyClass(secondsLeft)}`}
      >
        <svg viewBox="0 0 48 48" aria-hidden="true" className="absolute inset-0 -rotate-90">
          <circle
            cx="24"
            cy="24"
            r={RADIUS}
            fill="none"
            strokeWidth="4"
            className="stroke-[var(--border-soft)]"
          />
          <circle
            cx="24"
            cy="24"
            r={RADIUS}
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - fraction)}
            className="transition-[stroke-dashoffset] duration-1000 ease-linear"
          />
        </svg>
        {/* NFR-SYS-07: the number, not the ring's colour, is what tells the player the time. */}
        <span aria-hidden="true" className="text-[15px] font-semibold text-high">
          {secondsLeft}
        </span>
      </span>
    );

  if (zeroMessage === undefined) return ring;

  return (
    <div className="flex w-full flex-col items-center gap-1">
      {ring}
      {/* The space is always kept, so the panel doesn't jump when the message appears.
          w-0 with min-w-full stops these words from widening the panel in a narrow window. */}
      <p
        aria-live="polite"
        className="min-h-16 w-0 min-w-full text-center text-xs text-mid lg:min-h-12"
      >
        {secondsLeft === 0 ? zeroMessage : null}
      </p>
    </div>
  );
}
