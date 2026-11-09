import { FOCUS_RING } from "@/components/focusRing";
import { ShapeGlyph } from "@/components/ShapeGlyph";
import { PLAYER_IDENTITY } from "@/config/players";
import type { Colour } from "@/contract/types";

export type PieceState = "idle" | "movable" | "selected" | "dimmed" | "target";

// The board is light in both themes, so the rings use the dark piece edge to stay visible.
const STATE_CLASSES: Record<PieceState, string> = {
  idle: "",
  movable: "ring-2 ring-piece-edge ring-offset-1 ring-offset-board-cell",
  selected: "scale-110 ring-4 ring-piece-edge ring-offset-1 ring-offset-board-cell",
  dimmed: "opacity-40",
  // NFR-SYS-07: dashed, so a capture still stands out from the solid rings without the red.
  target: "outline-dashed outline-[3px] outline-offset-1 outline-danger",
};

export type PieceEffect = "capture" | "finish";

const EFFECT_CLASSES: Record<PieceEffect, string> = {
  capture: "animate-capture",
  finish: "animate-finish ring-4 ring-accent",
};

export interface PieceProps {
  colour: Colour;
  state?: PieceState;
  effect?: PieceEffect | null;
  label: string;
  disabled?: boolean;
  onSelect?: () => void;
  onPreview?: () => void;
  className?: string;
}

export function Piece({
  colour,
  state = "idle",
  effect = null,
  label,
  disabled = false,
  onSelect,
  onPreview,
  className = "",
}: PieceProps) {
  const { shape, token } = PLAYER_IDENTITY[colour];
  const effectClasses = effect ? EFFECT_CLASSES[effect] : "";
  const stateClasses = `block rounded-full transition-transform duration-150 ${STATE_CLASSES[state]} ${effectClasses} ${className}`;

  const face = (
    <span
      style={{ backgroundColor: token }}
      className="flex h-full w-full items-center justify-center rounded-full border-2 border-piece-edge"
    >
      <span className="flex h-3/5 w-3/5 items-center justify-center rounded-full bg-board-cell text-piece-edge">
        <ShapeGlyph shape={shape} className="h-3/5 w-3/5" />
      </span>
    </span>
  );

  // FR-SYS-03 POST-03-1: only a piece the server listed can be pressed.
  if (state === "movable" || state === "selected") {
    return (
      <button
        type="button"
        aria-label={label}
        aria-pressed={state === "selected"}
        // NFR-SYS-08: aria-disabled, so the keyboard keeps its place while a move is on its way.
        aria-disabled={disabled || undefined}
        data-state={state}
        onClick={() => {
          if (!disabled) onSelect?.();
        }}
        onFocus={onPreview}
        className={`${stateClasses} ${FOCUS_RING}`}
      >
        {face}
      </button>
    );
  }

  return (
    <span
      role="img"
      aria-label={label}
      data-state={state}
      data-effect={effect ?? undefined}
      className={stateClasses}
    >
      {face}
    </span>
  );
}
