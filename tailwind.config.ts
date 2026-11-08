import type { Config } from "tailwindcss";

// Every colour is a CSS variable, so a theme switch is one attribute on <html>
// and zero component changes (FR-SYS-10 POST-10-3).
// Keys drop the token's prefix so classes read `bg-panel` and `text-high`,
// not `bg-bg-panel` and `text-text-high`.
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        deep: "var(--bg-deep)",
        panel: "var(--bg-panel)",
        raised: "var(--bg-raised)",
        soft: "var(--border-soft)",
        "focus-ring": "var(--focus-ring)",
        high: "var(--text-high)",
        mid: "var(--text-mid)",
        low: "var(--text-low)",
        accent: "var(--accent)",
        "accent-press": "var(--accent-press)",
        "on-accent": "var(--on-accent)",
        danger: "var(--danger)",
        warning: "var(--warning)",
        "board-cell": "var(--board-cell)",
        "board-line": "var(--board-line)",
        "p-red": "var(--p-red)",
        "p-green": "var(--p-green)",
        "p-yellow": "var(--p-yellow)",
        "p-blue": "var(--p-blue)",
      },
    },
  },
  plugins: [],
} satisfies Config;
