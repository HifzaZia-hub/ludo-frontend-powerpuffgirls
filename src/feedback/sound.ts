import { Howl } from "howler";

// Six sounds in one file, made by scripts/make-sounds.py from models of real things: a die thrown
// onto a wooden board, a wooden pawn set down, a clack and whoosh home, climbing bells, a brass
// ta-da and a soft two-note "no". Each entry is [start, length] in milliseconds, every length
// stays under the 400 ms budget, and the script's SLOTS must agree with it.
export const SOUND_SPRITE = {
  roll: [0, 380],
  move: [500, 200],
  capture: [1000, 380],
  finish: [1500, 390],
  win: [2000, 395],
  error: [2500, 240],
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
