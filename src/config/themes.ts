// FR-SYS-10, P14: every theme is one block of CSS variables in src/styles/theme.css. Adding one
// takes a block there, its id here and its name in src/feedback/copy.ts, and no component changes.
// Dark stays the default.

export const THEMES = ["dark", "light", "neon", "forest", "minimal"] as const;

export type Theme = (typeof THEMES)[number];

export const DEFAULT_THEME: Theme = "dark";

export function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && (THEMES as readonly string[]).includes(value);
}
