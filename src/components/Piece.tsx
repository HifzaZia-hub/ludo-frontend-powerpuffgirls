import { FOCUS_RING } from "@/components/focusRing";
import { Pawn } from "@/components/Pawn";
import type { Colour } from "@/contract/types";

export type PieceState = "idle" | "movable" | "selected" | "dimmed" | "target";

// The board is light in both themes, so the rings use the dark piece edge to stay visible.
const STATE_CLASSES: Record<PieceState, string> = {
  idle: "",
  movable: "ring-2 ring-piece-edge ring-offset-1 ring-offset-board-cell hover:scale-110",
  selected: "scale-110 ring-4 ring-piece-edge ring-offset-1 ring-offset-board-cell",
  dimmed: "opacity-40",
  // NFR-SYS-07: dashed, so a capture still stands out from the solid rings without the red.
  target: "outline-dashed outline-[3px] outline-offset-1 outline-danger",
};

export type PieceEffect = "capture" | "finish";

// A ring bursts out of a captured piece, and sparks fly from one that reaches home (theme.css).
const EFFECT_CLASSES: Record<PieceEffect, string> = {
  capture: "animate-capture capture-puff",
  finish: "animate-finish finish-burst ring-4 ring-accent",
};

// A piece that can move bobs gently, asking to be picked; a chosen piece lifts off the board.
const PAWN_CLASSES: Record<PieceState, string> = {
  idle: "",
  movable: "pawn-bob",
  selected: "pawn-lift",
  dimmed: "",
  target: "",
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
  const effectClasses = effect ? EFFECT_CLASSES[effect] : "";
  const stateClasses = `relative block rounded-full transition-transform duration-150 ${STATE_CLASSES[state]} ${effectClasses} ${className}`;

  // NFR-SYS-07: the pawn's badge carries the player's shape, and the label says whose it is.
  const face = <Pawn colour={colour} className={`block h-full w-full ${PAWN_CLASSES[state]}`} />;

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
