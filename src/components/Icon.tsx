// Line icons on a 24-unit grid, drawn in the current text colour. Decoration only: whatever shows
// an icon also shows a word for it, so every icon is hidden from screen readers.

const PATHS = {
  play: "M8 5.5v13l10.5-6.5z",
  chevronRight: "M9.5 6l6 6-6 6",
  chevronLeft: "M14.5 6l-6 6 6 6",
  chevronDown: "M6 9.5l6 6 6-6",
  users:
    "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6M16 4.3a3.5 3.5 0 0 1 0 6.4M18 14.4c2.1.7 3.5 2.6 3.5 5.6",
  user: "M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4.4 3.6-7 8-7s8 2.6 8 7",
  info: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 16v-4.5M12 8h.01",
  bolt: "M13 2.5L4.5 13.5h6.5l-1 8 8.5-11h-6.5z",
  shield: "M12 2.5l8 3v6c0 5-3.4 8.7-8 10-4.6-1.3-8-5-8-10v-6zM8.5 12l2.5 2.5 4.5-5",
  trophy:
    "M8 3.5h8v5a4 4 0 0 1-8 0zM8 5.5H4.5a3 3 0 0 0 3.5 4M16 5.5h3.5a3 3 0 0 1-3.5 4M12 12.5v4M8.5 20.5h7M10 16.5h4v4h-4z",
  gamepad:
    "M7 8h10a4.5 4.5 0 0 1 4.4 5.4l-.8 4a2.5 2.5 0 0 1-4.4 1.1L14.5 16h-5l-1.7 2.5a2.5 2.5 0 0 1-4.4-1.1l-.8-4A4.5 4.5 0 0 1 7 8zM8 11v3M6.5 12.5h3M15.5 12h.01M17.5 13.5h.01",
  bars: "M5 20v-5M10 20v-9M15 20V7M20 20V4",
  palette:
    "M12 3a9 9 0 1 0 0 18c1.2 0 1.8-.9 1.4-2l-.4-1a1.6 1.6 0 0 1 1.5-2.2H17a4 4 0 0 0 4-4c0-4.9-4-8.8-9-8.8zM7.5 12h.01M9.5 7.5h.01M14.5 7.5h.01",
  monitor: "M3.5 4.5h17v11h-17zM9 20h6M12 15.5V20",
  speaker: "M4 9.5h3.5L12 5.5v13l-4.5-4H4zM15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11",
  rocket:
    "M12 15.5l-3.5-3.5c1.5-4.5 4.5-8 10-8.5-.5 5.5-4 8.5-6.5 12zM8.5 12l-3-.5L7.5 8.5h4M12 15.5l.5 3 3-2v-4M6 18c-1.5.5-2 2-2 2s1.5-.5 2-2c.5-.5.5-1.5 0-2",
} as const;

// Shapes drawn filled rather than as lines.
const FILLED = new Set<IconName>(["play", "bolt"]);

export type IconName = keyof typeof PATHS;

export interface IconProps {
  name: IconName;
  className?: string;
}

export function Icon({ name, className = "h-5 w-5" }: IconProps) {
  const filled = FILLED.has(name);
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={filled ? 1 : 2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
