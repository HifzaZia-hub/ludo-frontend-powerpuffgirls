// Framer Motion can't read the CSS rules that shorten motion in theme.css, so it asks here.

import type { AnimationMode } from "@/store/settingsStore";

const PIECE_TWEEN_SECONDS: Record<AnimationMode, number> = { on: 0.25, fast: 0.12, off: 0 };

// POST-10-2: this only changes how long a piece takes to get where the snapshot put it.
export function pieceTweenSeconds(animation: AnimationMode, reducedMotion: boolean): number {
  return reducedMotion ? 0 : PIECE_TWEEN_SECONDS[animation];
}
