// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEFAULT_THEME, isTheme, THEMES } from "@/config/themes";
import { LABELS } from "@/feedback/copy";

const css = readFileSync(new URL("../styles/theme.css", import.meta.url), "utf8");

/** The custom properties set in the CSS block for one theme. */
function tokensOf(theme: string): Set<string> {
  const start = css.search(new RegExp(`html\\[data-theme="${theme}"\\]`));
  if (start === -1) return new Set();
  const block = css.slice(start, css.indexOf("}", start));
  return new Set([...block.matchAll(/(--[a-z-]+)\s*:/g)].map((match) => match[1] ?? ""));
}

describe("themes", () => {
  it("starts on dark", () => {
    expect(DEFAULT_THEME).toBe("dark");
  });

  // P14: a theme missing a colour would quietly borrow dark's and could become unreadable.
  it.each(THEMES)("%s sets every colour the dark theme sets", (theme) => {
    const dark = tokensOf("dark");
    expect(dark.size).toBeGreaterThan(15);
    expect([...dark].filter((token) => !tokensOf(theme).has(token))).toEqual([]);
  });

  it.each(THEMES)("%s says whether it is dark or light, for scrollbars", (theme) => {
    const start = css.search(new RegExp(`html\\[data-theme="${theme}"\\]`));
    expect(css.slice(start, css.indexOf("}", start))).toMatch(/color-scheme:\s*(dark|light)/);
  });

  it.each(THEMES)("%s has a name to show", (theme) => {
    expect(LABELS[theme]).toMatch(/\w/);
  });

  it("knows a theme from anything else", () => {
    expect(isTheme("forest")).toBe(true);
    expect(isTheme("sepia")).toBe(false);
    expect(isTheme(undefined)).toBe(false);
  });
});
