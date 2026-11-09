import type { Ref } from "react";
import { Card } from "@/components/Card";
import { CountdownRing } from "@/components/CountdownRing";
import { Dice } from "@/components/Dice";
import { GAME_TEXT, sixesLabel } from "@/feedback/copy";

const SIXES_PIPS = [0, 1, 2];

export interface DicePanelProps {
  value: number | null; // always the server's turn.lastRoll
  rolling: boolean;
  canRoll: boolean;
  onRoll: () => void;
  sixesInRow: number | null; // null when the rules don't count sixes
  sixesFlash?: boolean;
  getSecondsLeft: (() => number | null) | null; // null when the rules have no turn timer
  totalSeconds: number;
  showTimeUp: boolean;
  dieRef?: Ref<HTMLButtonElement>;
  className?: string;
}

export function DicePanel({
  value,
  rolling,
  canRoll,
  onRoll,
  sixesInRow,
  sixesFlash = false,
  getSecondsLeft,
  totalSeconds,
  showTimeUp,
  dieRef,
  className = "",
}: DicePanelProps) {
  return (
    <Card className={`flex flex-col items-center gap-2 ${className}`}>
      <Dice ref={dieRef} value={value} rolling={rolling} disabled={!canRoll} onRoll={onRoll} />

      {sixesInRow !== null && (
        <div
          role="img"
          aria-label={sixesLabel(sixesInRow)}
          data-sixes-flash={sixesFlash || undefined}
          className={`flex items-center gap-1.5 ${sixesFlash ? "animate-sixes-flash" : ""}`}
        >
          {/* NFR-SYS-07: filled against hollow, so the count doesn't rely on colour. */}
          {SIXES_PIPS.map((pip) => (
            <span
              key={pip}
              data-six={pip < sixesInRow ? "filled" : "empty"}
              className={`h-3 w-3 rounded-full border-2 border-mid ${pip < sixesInRow ? "bg-mid" : ""}`}
            />
          ))}
          <span className="text-xs text-mid">{GAME_TEXT.sixes}</span>
        </div>
      )}

      {/* The server acts when time runs out, so nothing here sends anything. */}
      {getSecondsLeft && (
        <CountdownRing
          getSecondsLeft={getSecondsLeft}
          totalSeconds={totalSeconds}
          zeroMessage={showTimeUp ? GAME_TEXT.timeUp : null}
        />
      )}
    </Card>
  );
}
