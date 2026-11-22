export interface CrownProps {
  className?: string;
}

// A gold crown, for the winner and above the front page's die. Decoration only.
export function Crown({ className = "" }: CrownProps) {
  return (
    <svg viewBox="0 0 32 22" aria-hidden="true" className={className}>
      <path
        d="M2 6l7 6 7-10 7 10 7-6-3 14H5z"
        strokeWidth="1.2"
        strokeLinejoin="round"
        style={{ fill: "var(--warning)", stroke: "var(--piece-edge)" }}
      />
      <g style={{ fill: "var(--board-cell)" }}>
        <circle cx="2" cy="6" r="1.6" />
        <circle cx="16" cy="2" r="1.6" />
        <circle cx="30" cy="6" r="1.6" />
      </g>
    </svg>
  );
}
