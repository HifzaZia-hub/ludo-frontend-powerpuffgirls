import { FOCUS_RING } from "@/components/focusRing";
import { diceLabel, LABELS } from "@/feedback/copy";

// Which of the nine spots on a die face hold a pip. Drawing only: the value always comes from
// the server.
const PIP_SPOTS: Record<number, readonly number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

const NINE_SPOTS = [0, 1, 2, 3, 4, 5, 6, 7, 8];

export interface DiceProps {
  value: number | null; // always the server's turn.lastRoll
  rolling: boolean;
  disabled: boolean;
  onRoll: () => void;
}

export function Dice({ value, rolling, disabled, onRoll }: DiceProps) {
  // NFR-SYS-05: a blank die tumbles. Showing a number here would be a value the server never sent.
  const face = rolling ? null : value;
  const pips = face === null ? [] : (PIP_SPOTS[face] ?? []);

  return (
    <button
      type="button"
      disabled={disabled || rolling}
      onClick={onRoll}
      aria-label={diceLabel(face, rolling)}
      aria-busy={rolling || undefined}
      className={`flex flex-col items-center gap-2 rounded-2xl p-2 font-semibold text-high transition-transform duration-[80ms] active:scale-[0.97] disabled:cursor-not-allowed ${FOCUS_RING}`}
    >
      <span
        className={`grid h-20 w-20 grid-cols-3 grid-rows-3 place-items-center rounded-2xl border-2 border-piece-edge bg-board-cell p-2 ${
          rolling ? "animate-tumble" : ""
        }`}
      >
        {NINE_SPOTS.map((spot) =>
          pips.includes(spot) ? (
            <span key={spot} data-pip="" className="h-3 w-3 rounded-full bg-piece-edge" />
          ) : (
            <span key={spot} />
          ),
        )}
      </span>
      {/* Only the word fades when disabled. Every player needs to read the server's roll. */}
      <span className={`text-[15px] ${disabled && !rolling ? "text-low" : ""}`}>
        {rolling ? LABELS.rolling : LABELS.roll}
      </span>
    </button>
  );
}
