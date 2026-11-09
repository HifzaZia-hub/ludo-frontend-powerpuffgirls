// Framer Motion and timers can't read the CSS rules that shorten motion in theme.css, so they ask here.

import type { AnimationMode } from "@/store/settingsStore";

const PIECE_TWEEN_SECONDS: Record<AnimationMode, number> = { on: 0.25, fast: 0.12, off: 0 };
const PIECE_STEP_MS: Record<AnimationMode, number> = { on: 120, fast: 50, off: 0 };
const DICE_TUMBLE_MS: Record<AnimationMode, number> = { on: 600, fast: 250, off: 0 };

// POST-10-2: this only changes how long a piece takes to get where the snapshot put it.
export function pieceTweenSeconds(animation: AnimationMode, reducedMotion: boolean): number {
  return reducedMotion ? 0 : PIECE_TWEEN_SECONDS[animation];
}

// FR-SYS-05 POST-05-2: this only changes how long a walk takes. 0 means no walk at all.
export function pieceStepMs(animation: AnimationMode, reducedMotion: boolean): number {
  return reducedMotion ? 0 : PIECE_STEP_MS[animation];
}

const CAPTURE_FLASH_MS: Record<AnimationMode, number> = { on: 150, fast: 60, off: 0 };
const CAPTURE_RETURN_MS: Record<AnimationMode, number> = { on: 400, fast: 150, off: 0 };
const FINISH_MS: Record<AnimationMode, number> = { on: 400, fast: 150, off: 0 };

export interface EventTimings {
  stepMs: number;
  flashMs: number;
  returnMs: number;
  finishMs: number;
}

// FR-SYS-05 POST-05-2: these only change how long the feedback takes, never what happened.
export function eventTimings(animation: AnimationMode, reducedMotion: boolean): EventTimings {
  const pick = (table: Record<AnimationMode, number>) => (reducedMotion ? 0 : table[animation]);
  return {
    stepMs: pieceStepMs(animation, reducedMotion),
    flashMs: pick(CAPTURE_FLASH_MS),
    returnMs: pick(CAPTURE_RETURN_MS),
    finishMs: pick(FINISH_MS),
  };
}

// POST-10-2: this only changes how long the die spins. It always lands on the server's value.
export function diceTumbleMs(animation: AnimationMode, reducedMotion: boolean): number {
  return reducedMotion ? 0 : DICE_TUMBLE_MS[animation];
}
