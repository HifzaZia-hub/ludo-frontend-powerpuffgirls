import { shapeElement } from "@/components/ShapeGlyph";
import { PLAYER_IDENTITY } from "@/config/players";
import type { Colour } from "@/contract/types";

// On a 24-unit grid: a base, a flared body, a collar and a round head.
const BODY = "M9.1 9.7C8.8 13.2 6.9 16.2 5.6 18.4H18.4C17.1 16.2 15.2 13.2 14.9 9.7Z";
const BODY_SHADE = "M13.4 9.9C13.8 13.2 15.4 16.1 16.7 18.4H18.4C17.1 16.2 15.2 13.2 14.9 9.7Z";
const BODY_SHINE = "M9.9 10.5C9.7 13 8.7 15.3 7.6 17.2";

// The emblem: the player's shape printed on the pawn's body, 7.4 units across on the pawn's
// 24-unit grid, centred on the widest part of the body.
const EMBLEM_SIZE = 7.4;
const EMBLEM_X = 12;
const EMBLEM_Y = 14.4;
const EMBLEM_SCALE = EMBLEM_SIZE / 24;
const EMBLEM_AT = `translate(${EMBLEM_X - EMBLEM_SIZE / 2} ${EMBLEM_Y - EMBLEM_SIZE / 2}) scale(${EMBLEM_SCALE})`;
// The outline is 0.7 units wide on the pawn, drawn under the fill so only its outer half shows.
const EMBLEM_OUTLINE = 1.4 / EMBLEM_SCALE;

export interface PawnProps {
  colour: Colour;
  className?: string;
  /** The player's shape on the body. On by default: a pawn on the board needs it
   *  (NFR-SYS-07). Leave it off only where a PlayerMark beside the pawn says whose it is. */
  badge?: boolean;
}

// A glossy pawn in the player's colour. Decoration only, so it is hidden from screen readers;
// whatever shows it gives the name or label. NFR-SYS-07: the player's shape is printed on the
// body in white, outlined in a deeper shade of the pawn's own colour, so pawns are told apart
// without colour: the white reads on the darker bodies, and the outline carries it on yellow and
// in grayscale. The shine and shade are translucent shapes in the theme's own colours, so the
// pawn suits every theme and needs no gradient ids.
export function Pawn({ colour, className = "", badge = true }: PawnProps) {
  const { shape, token } = PLAYER_IDENTITY[colour];
  const fill = { fill: token };
  const deep = `color-mix(in oklab, ${token} 45%, var(--piece-edge))`;
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
        <g transform={EMBLEM_AT} data-emblem={shape}>
          {/* A soft shadow just below it, so it sits on the body like a printed mark. */}
          <g transform="translate(0 1.6)" opacity="0.35" style={{ fill: deep }}>
            {shapeElement(shape)}
          </g>
          <g
            strokeWidth={EMBLEM_OUTLINE}
            strokeLinejoin="round"
            style={{ fill: "var(--board-cell)", stroke: deep, paintOrder: "stroke" }}
          >
            {shapeElement(shape)}
          </g>
        </g>
      )}
    </svg>
  );
}
