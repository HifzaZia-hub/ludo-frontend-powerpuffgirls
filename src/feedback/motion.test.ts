import { diceTumbleMs, pieceStepMs, pieceTweenSeconds } from "@/feedback/motion";

describe("pieceStepMs", () => {
  it("follows the animation budget", () => {
    expect(pieceStepMs("on", false)).toBe(120);
    expect(pieceStepMs("fast", false)).toBe(50);
    expect(pieceStepMs("off", false)).toBe(0);
  });

  it("means no walk at all with reduced motion", () => {
    expect(pieceStepMs("on", true)).toBe(0);
  });
});

describe("diceTumbleMs", () => {
  it("follows the animation budget", () => {
    expect(diceTumbleMs("on", false)).toBe(600);
    expect(diceTumbleMs("fast", false)).toBe(250);
    expect(diceTumbleMs("off", false)).toBe(0);
  });

  it("is instant with reduced motion", () => {
    expect(diceTumbleMs("on", true)).toBe(0);
  });
});

describe("pieceTweenSeconds", () => {
  it("gets shorter with each animation setting", () => {
    expect(pieceTweenSeconds("on", false)).toBeGreaterThan(pieceTweenSeconds("fast", false));
    expect(pieceTweenSeconds("fast", false)).toBeGreaterThan(0);
    expect(pieceTweenSeconds("off", false)).toBe(0);
  });

  it.each(["on", "fast", "off"] as const)("is instant with reduced motion and %s", (animation) => {
    expect(pieceTweenSeconds(animation, true)).toBe(0);
  });
});
