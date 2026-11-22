import { forwardRef, lazy, Suspense, type PointerEvent } from "react";
import { DiceFace } from "@/components/DiceFace";
import { FallbackBoundary } from "@/components/FallbackBoundary";
import { FOCUS_RING } from "@/components/focusRing";
import { diceLabel, LABELS } from "@/feedback/copy";

// P14: three.js is large, so it downloads only for a player who turns the 3D die on.
const Die3D = lazy(() => import("@/components/Die3D").then(({ Die3D }) => ({ default: Die3D })));

export interface DiceProps {
  value: number | null; // always the server's turn.lastRoll
  rolling: boolean;
  disabled: boolean;
  onRoll: () => void;
  /** P14: draw it in 3D. The flat die shows while it loads, and stays if 3D can't draw. */
  threeD?: boolean;
}

export const Dice = forwardRef<HTMLButtonElement, DiceProps>(function Dice(
  { value, rolling, disabled, onRoll, threeD = false },
  ref,
) {
  // NFR-SYS-05: a blank die tumbles. Showing a number here would be a value the server never sent.
  const face = rolling ? null : value;
  const unavailable = disabled || rolling;
  const flat = <DiceFace face={face} rolling={rolling} />;

  // NFR-SYS-08: aria-disabled rather than disabled, because a disabled button drops keyboard
  // focus and the player would lose their place after every roll.
  function handleClick() {
    if (!unavailable) onRoll(); // FR-SYS-02 EXC-02-1
  }

  // The die leans toward a mouse pointer over it. Looks only: it changes nothing in the game.
  function handlePointerMove(event: PointerEvent<HTMLButtonElement>) {
    if (event.pointerType !== "mouse") return;
    const box = event.currentTarget.getBoundingClientRect();
    const across = (event.clientX - box.left) / box.width - 0.5;
    const down = (event.clientY - box.top) / box.height - 0.5;
    event.currentTarget.style.setProperty("--hover-y", `${(across * 28).toFixed(1)}deg`);
    event.currentTarget.style.setProperty("--hover-x", `${(-down * 28).toFixed(1)}deg`);
  }

  function handlePointerLeave(event: PointerEvent<HTMLButtonElement>) {
    event.currentTarget.style.removeProperty("--hover-x");
    event.currentTarget.style.removeProperty("--hover-y");
  }

  return (
    <button
      ref={ref}
      type="button"
      aria-disabled={unavailable || undefined}
      onClick={handleClick}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      aria-label={diceLabel(face, rolling)}
      aria-busy={rolling || undefined}
      className={`die-press flex flex-col items-center gap-2 rounded-2xl p-2 font-semibold text-high transition-transform duration-[80ms] active:scale-[0.97] aria-disabled:cursor-not-allowed aria-disabled:active:scale-100 ${FOCUS_RING}`}
    >
      {threeD ? (
        <FallbackBoundary fallback={flat}>
          <Suspense fallback={flat}>
            <Die3D face={face} rolling={rolling} />
          </Suspense>
        </FallbackBoundary>
      ) : (
        flat
      )}
      {/* Only the word fades when disabled. Every player needs to read the server's roll. */}
      <span className={`text-[15px] ${disabled && !rolling ? "text-low" : ""}`}>
        {rolling ? LABELS.rolling : LABELS.roll}
      </span>
    </button>
  );
});
