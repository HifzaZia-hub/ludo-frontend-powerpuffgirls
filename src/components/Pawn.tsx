import { shapeElement } from "@/components/ShapeGlyph";
import { PLAYER_IDENTITY } from "@/config/players";
import type { Colour } from "@/contract/types";

// On a 24-unit grid: a base, a flared body, a collar and a round head.
const BODY = "M9.1 9.7C8.8 13.2 6.9 16.2 5.6 18.4H18.4C17.1 16.2 15.2 13.2 14.9 9.7Z";
const BODY_SHADE = "M13.4 9.9C13.8 13.2 15.4 16.1 16.7 18.4H18.4C17.1 16.2 15.2 13.2 14.9 9.7Z";
const BODY_SHINE = "M9.9 10.5C9.7 13 8.7 15.3 7.6 17.2";

export interface PawnProps {
  colour: Colour;
  className?: string;
  /** The white badge with the player's shape. On by default: a pawn on the board needs it
   *  (NFR-SYS-07). Leave it off only where a PlayerMark beside the pawn says whose it is. */
  badge?: boolean;
}

// A glossy pawn in the player's colour. Decoration only, so it is hidden from screen readers;
// whatever shows it gives the name or label. NFR-SYS-07: the white badge carries the player's
// shape, so pawns are told apart without colour. The shine and shade are translucent shapes in
// the theme's own colours, so the pawn suits every theme and needs no gradient ids.
export function Pawn({ colour, className = "", badge = true }: PawnProps) {
  const { shape, token } = PLAYER_IDENTITY[colour];
  const fill = { fill: token };
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" data-pawn={colour} className={`pawn ${className}`}>
      <g stroke="var(--piece-edge)" strokeWidth="0.6" strokeLinejoin="round">
        <ellipse cx="12" cy="19.1" rx="7.6" ry="2.4" style={fill} />
        <path d={BODY} style={fill} />
      </g>
      <ellipse
        cx="12"
        cy="19.7"
        rx="7.2"
        ry="1.6"
        opacity="0.2"
        style={{ fill: "var(--piece-edge)" }}
      />
      <path d={BODY_SHADE} opacity="0.22" style={{ fill: "var(--piece-edge)" }} />
      <path
        d={BODY_SHINE}
        fill="none"
        strokeWidth="0.9"
        strokeLinecap="round"
        opacity="0.55"
        style={{ stroke: "var(--board-cell)" }}
      />
      <g stroke="var(--piece-edge)" strokeWidth="0.6">
        <ellipse cx="12" cy="9.3" rx="3.1" ry="1.05" style={fill} />
        <circle cx="12" cy="5.4" r="3.6" style={fill} />
      </g>
      <ellipse
        cx="10.7"
        cy="4.1"
        rx="1.5"
        ry="0.95"
        transform="rotate(-35 10.7 4.1)"
        opacity="0.8"
        style={{ fill: "var(--board-cell)" }}
      />
      {badge && (
        <>
          <circle
            cx="12"
            cy="15.2"
            r="4"
            strokeWidth="0.45"
            style={{ fill: "var(--board-cell)", stroke: "var(--piece-edge)" }}
          />
          <g transform="translate(9.15 12.35) scale(0.2375)" style={{ fill: "var(--piece-edge)" }}>
            {shapeElement(shape)}
          </g>
        </>
      )}
    </svg>
  );
}
