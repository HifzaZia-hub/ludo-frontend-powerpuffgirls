import type { CSSProperties } from "react";
import { NINE_SPOTS, PIP_SPOTS } from "@/config/diceFaces";

// A real die's faces: opposite faces add up to 7. The class names are written out in full:
// Tailwind keeps a theme.css component rule only if it finds its class name in the code, so a
// name built as `die-face--${side}` would lose its rule and every face would lie flat.
const FACES = [
  { pips: 1, side: "die-face--front" },
  { pips: 6, side: "die-face--back" },
  { pips: 3, side: "die-face--right" },
  { pips: 4, side: "die-face--left" },
  { pips: 2, side: "die-face--top" },
  { pips: 5, side: "die-face--bottom" },
] as const;

// How to turn the die so this number faces the player.
const TURN_TO_FRONT: Record<number, string> = {
  1: "rotateY(0deg)",
  6: "rotateY(180deg)",
  3: "rotateY(-90deg)",
  4: "rotateY(90deg)",
  2: "rotateX(-90deg)",
  5: "rotateX(90deg)",
};

// Once turned, which number shows on top and which on the right, for the shading.
const ON_TOP: Record<number, number> = { 1: 2, 6: 2, 3: 2, 4: 2, 2: 6, 5: 1 };
const ON_RIGHT: Record<number, number> = { 1: 3, 6: 4, 3: 6, 4: 1, 2: 3, 5: 3 };

export interface DieCubeProps {
  /** The number facing the player, or null for a blank die (while it tumbles). */
  value: number | null;
  /** Marks the front face's pips with data-pip, so tests can count the value shown. */
  markValue?: boolean;
  /** Light the faces for a die at rest. Off for a die that turns freely. */
  shaded?: boolean;
  className?: string;
  style?: CSSProperties;
}

// The cube itself, drawn in CSS (theme.css .die-*). It shows only the number it is given:
// DiceFace passes the server's value (NFR-SYS-05), and the front page's die is decoration.
export function DieCube({
  value,
  markValue = false,
  shaded = true,
  className = "",
  style,
}: DieCubeProps) {
  const front = value ?? 1;
  const cubeStyle = { "--face-turn": TURN_TO_FRONT[front], ...style } as CSSProperties;

  return (
    <span className={`die-cube block ${className}`} style={cubeStyle}>
      {FACES.map(({ pips, side }) => {
        let lighting = "";
        if (shaded && value !== null) {
          if (pips === ON_TOP[front]) lighting = "is-top";
          else if (pips === ON_RIGHT[front]) lighting = "is-right";
        }
        const spots = value === null ? [] : (PIP_SPOTS[pips] ?? []);
        return (
          <span key={side} className={`die-face ${side} ${lighting}`}>
            {NINE_SPOTS.map((spot) =>
              spots.includes(spot) ? (
                <span
                  key={spot}
                  className="die-pip"
                  {...(markValue && pips === value ? { "data-pip": "" } : {})}
                />
              ) : (
                <span key={spot} />
              ),
            )}
          </span>
        );
      })}
    </span>
  );
}
