export interface DieIconProps {
  className?: string;
}

// The five-spot die beside the LUDO wordmark. Decoration only.
export function DieIcon({ className = "" }: DieIconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={`pawn ${className}`}>
      <rect
        x="2"
        y="2"
        width="20"
        height="20"
        rx="5"
        strokeWidth="1"
        style={{ fill: "var(--board-cell)", stroke: "var(--piece-edge)" }}
      />
      <g style={{ fill: "var(--piece-edge)" }}>
        <circle cx="7.5" cy="7.5" r="1.9" />
        <circle cx="16.5" cy="7.5" r="1.9" />
        <circle cx="12" cy="12" r="1.9" />
        <circle cx="7.5" cy="16.5" r="1.9" />
        <circle cx="16.5" cy="16.5" r="1.9" />
      </g>
    </svg>
  );
}
