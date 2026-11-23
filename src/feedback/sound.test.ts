import { readFileSync } from "node:fs";
import { join } from "node:path";

const { play, created } = vi.hoisted(() => ({ play: vi.fn(), created: vi.fn() }));

vi.mock("howler", () => ({
  Howl: class {
    constructor(options: unknown) {
      created(options);
    }
    play = play;
  },
}));

// The module remembers the first press for the whole session, so each test needs a fresh copy.
async function freshSound() {
  vi.resetModules();
  return import("@/feedback/sound");
}

function press() {
  window.dispatchEvent(new Event("pointerdown"));
}

describe("sound", () => {
  beforeEach(() => {
    play.mockClear();
    created.mockClear();
  });

  it("stays silent until the player has pressed something", async () => {
    const { listenForFirstGesture, playSound } = await freshSound();
    const stop = listenForFirstGesture();

    playSound("roll", true);

    expect(created).not.toHaveBeenCalled();
    expect(play).not.toHaveBeenCalled();
    stop();
  });

  it("plays after a press", async () => {
    const { listenForFirstGesture, playSound } = await freshSound();
    listenForFirstGesture();
    press();

    playSound("capture", true);

    expect(play).toHaveBeenCalledWith("capture");
  });

  it("counts a key as a press, for keyboard players", async () => {
    const { listenForFirstGesture, playSound } = await freshSound();
    listenForFirstGesture();
    window.dispatchEvent(new Event("keydown"));

    playSound("move", true);

    expect(play).toHaveBeenCalledWith("move");
  });

  // FR-SYS-10
  it("does nothing with sound off, and doesn't even load the file", async () => {
    const { listenForFirstGesture, playSound } = await freshSound();
    listenForFirstGesture();
    press();

    playSound("win", false);

    expect(created).not.toHaveBeenCalled();
    expect(play).not.toHaveBeenCalled();
  });

  it("loads the file only once", async () => {
    const { listenForFirstGesture, playSound } = await freshSound();
    listenForFirstGesture();
    press();

    playSound("roll", true);
    playSound("move", true);

    expect(created).toHaveBeenCalledTimes(1);
    expect(play).toHaveBeenCalledTimes(2);
  });

  it("stops listening when asked", async () => {
    const { listenForFirstGesture, playSound } = await freshSound();
    const stop = listenForFirstGesture();
    stop();
    press();

    playSound("roll", true);

    expect(play).not.toHaveBeenCalled();
  });

  // docs/prompts: every sound under 400 ms.
  it("has six sounds, each short and none overlapping", async () => {
    const { SOUND_SPRITE } = await freshSound();
    const entries = Object.values(SOUND_SPRITE).sort((a, b) => a[0] - b[0]);

    expect(Object.keys(SOUND_SPRITE).sort()).toEqual([
      "capture",
      "error",
      "finish",
      "move",
      "roll",
      "win",
    ]);
    entries.forEach(([start, length], index) => {
      expect(length).toBeLessThan(400);
      const following = entries[index + 1];
      if (following) expect(start + length).toBeLessThanOrEqual(following[0]);
    });
  });

  // The real file must match the list: each sound is where sound.ts says, ends inside its slot
  // (so playing one never clips the start of the next), and never hits full scale.
  it("finds every sound in the file where the list says, whole and unclipped", async () => {
    const { SOUND_SPRITE } = await freshSound();
    // Found from the project folder: in this browser-like test, import.meta.url is not a file.
    const file = readFileSync(join(process.cwd(), "public", "sounds", "sprite.wav"));
    const rate = file.readUInt32LE(24);
    const bits = file.readUInt16LE(34);
    const level = (ms: number) =>
      Math.abs(file.readInt16LE(44 + 2 * Math.round((ms * rate) / 1000))) / 32768;
    const loudest = (from: number, to: number) => {
      let peak = 0;
      for (let ms = from; ms < to; ms += 1000 / rate) peak = Math.max(peak, level(ms));
      return peak;
    };

    expect(bits).toBe(16);
    for (const [start, length] of Object.values(SOUND_SPRITE)) {
      expect(loudest(start, start + length)).toBeGreaterThan(0.2);
      expect(loudest(start, start + length)).toBeLessThan(0.97);
      expect(loudest(start + length, start + length + 50)).toBeLessThan(0.002);
    }
  });
});
