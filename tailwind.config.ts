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
        "on-danger": "var(--on-danger)",
        warning: "var(--warning)",
        "piece-edge": "var(--piece-edge)",
        "board-cell": "var(--board-cell)",
        "board-line": "var(--board-line)",
        "p-red": "var(--p-red)",
        "p-green": "var(--p-green)",
        "p-yellow": "var(--p-yellow)",
        "p-blue": "var(--p-blue)",
      },
      keyframes: {
        tumble: { to: { transform: "rotate(360deg)" } },
        thinking: { "0%, 80%, 100%": { opacity: "0.3" }, "40%": { opacity: "1" } },
        // Only opacity and transform, so these stay smooth while the board is busy.
        capture: {
          "0%, 100%": { transform: "translateX(0)", opacity: "1" },
          "25%": { transform: "translateX(-14%)", opacity: "0.25" },
          "50%": { transform: "translateX(14%)", opacity: "1" },
          "75%": { transform: "translateX(-10%)", opacity: "0.25" },
        },
        finish: {
          "0%, 100%": { transform: "scale(1)", opacity: "1" },
          "50%": { transform: "scale(1.5)", opacity: "0.7" },
        },
        bump: { "0%, 100%": { transform: "scale(1)" }, "50%": { transform: "scale(1.5)" } },
        "sixes-flash": { "0%, 50%, 100%": { opacity: "1" }, "25%, 75%": { opacity: "0.15" } },
      },
      animation: {
        tumble: "tumble 600ms linear infinite",
        thinking: "thinking 1s ease-in-out infinite",
        capture: "capture 150ms linear",
        finish: "finish 400ms ease-out",
        bump: "bump 400ms ease-out",
        "sixes-flash": "sixes-flash 400ms linear",
      },
    },
  },
  plugins: [],
} satisfies Config;
