import { diceTumbleMs, pieceTweenSeconds } from "@/feedback/motion";

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
