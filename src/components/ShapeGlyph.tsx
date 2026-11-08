import type { PlayerShape } from "@/config/players";

const SHAPE_ELEMENTS: Record<PlayerShape, JSX.Element> = {
  circle: <circle cx="12" cy="12" r="9" />,
  triangle: <polygon points="12,3 22,21 2,21" />,
  square: <rect x="4" y="4" width="16" height="16" />,
  diamond: <polygon points="12,2 22,12 12,22 2,12" />,
};

export interface ShapeGlyphProps {
  shape: PlayerShape;
  className?: string;
}

// An SVG rather than a text glyph, so all four shapes look the same size on every system font.
export function ShapeGlyph({ shape, className = "" }: ShapeGlyphProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      {SHAPE_ELEMENTS[shape]}
    </svg>
  );
}
