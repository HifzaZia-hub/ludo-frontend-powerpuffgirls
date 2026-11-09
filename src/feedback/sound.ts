import { Howl } from "howler";

// Placeholder tones, generated for P9. Each entry is [start, length] in milliseconds, and every
// length stays under the 400 ms budget. Swapping in real sounds only means replacing the file.
export const SOUND_SPRITE = {
  roll: [0, 300],
  move: [500, 100],
  capture: [1000, 300],
  finish: [1500, 350],
  win: [2000, 390],
  error: [2500, 200],
} satisfies Record<string, [number, number]>;

export type SoundName = keyof typeof SOUND_SPRITE;

let howl: Howl | null = null;
let gestureSeen = false;

/** Browsers refuse sound before the player has pressed something. Returns the way to stop listening. */
export function listenForFirstGesture(): () => void {
  function stop() {
    window.removeEventListener("pointerdown", seen, true);
    window.removeEventListener("keydown", seen, true);
  }
  function seen() {
    gestureSeen = true;
    stop();
  }

  if (gestureSeen) return () => undefined;
  window.addEventListener("pointerdown", seen, true);
  window.addEventListener("keydown", seen, true);
  return stop;
}

// FR-SYS-10 POST-10-2: sound never affects the game, so a failure here is simply silence.
export function playSound(name: SoundName, enabled: boolean): void {
  if (!enabled || !gestureSeen) return;
  // Made on first use, so a player with sound off never downloads the file.
  howl ??= new Howl({
    src: [`${import.meta.env.BASE_URL}sounds/sprite.wav`],
    sprite: SOUND_SPRITE,
  });
  howl.play(name);
}
