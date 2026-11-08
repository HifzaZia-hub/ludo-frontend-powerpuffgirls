import { useState } from "react";

type Theme = "dark" | "light";

const THEMES: readonly { value: Theme; label: string }[] = [
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
];

// NFR-SYS-07: colour, shape and letter together. Temporary copy for this starter
// page only; P1 moves the real mapping to src/config/players.ts.
const PLAYER_DOTS = [
  { name: "Red", letter: "R", shape: "●", colorClass: "bg-p-red" },
  { name: "Green", letter: "G", shape: "▲", colorClass: "bg-p-green" },
  { name: "Yellow", letter: "Y", shape: "■", colorClass: "bg-p-yellow" },
  { name: "Blue", letter: "B", shape: "◆", colorClass: "bg-p-blue" },
] as const;

const FOCUS_RING =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 " +
  "focus-visible:outline-focus-ring";

// P0 starter page: proves the tokens work in both themes. Replaced in P5.
export function App() {
  const [theme, setTheme] = useState<Theme>(() =>
    document.documentElement.dataset.theme === "light" ? "light" : "dark",
  );

  // FR-SYS-10 POST-10-3: a theme switch is only this attribute, so it can never
  // touch game state.
  function chooseTheme(next: Theme) {
    document.documentElement.dataset.theme = next;
    setTheme(next);
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-4">
      <h1 className="text-[32px] font-bold tracking-widest">LUDO</h1>

      <button
        type="button"
        className={`rounded-full bg-accent px-8 py-3 text-[15px] font-semibold text-on-accent active:bg-accent-press ${FOCUS_RING}`}
      >
        Play
      </button>

      <ul className="flex gap-6" aria-label="Player colours">
        {PLAYER_DOTS.map((dot) => (
          <li key={dot.name} className="flex flex-col items-center gap-2">
            <span
              className={`flex h-14 w-14 items-center justify-center rounded-full ${dot.colorClass}`}
            >
              {/* The inner chip keeps the shape readable on all four colours in both themes. */}
              <span
                aria-hidden="true"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-panel text-lg text-high"
              >
                {dot.shape}
              </span>
            </span>
            <span className="text-xs font-semibold uppercase text-high">
              {dot.letter} · {dot.name}
            </span>
          </li>
        ))}
      </ul>

      <div
        role="group"
        aria-label="Theme"
        className="flex gap-1 rounded-full border border-soft bg-panel p-1"
      >
        {THEMES.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            aria-pressed={theme === value}
            onClick={() => chooseTheme(value)}
            className={`rounded-full px-4 py-1 text-xs font-semibold active:bg-raised ${FOCUS_RING} ${
              theme === value ? "bg-raised text-high" : "text-mid"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </main>
  );
}
