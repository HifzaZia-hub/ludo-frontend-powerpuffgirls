import { ShapeGlyph } from "@/components/ShapeGlyph";
import { PLAYER_IDENTITY } from "@/config/players";
import type { Colour } from "@/contract/types";
import { COLOUR_NAMES } from "@/feedback/copy";

type MarkSize = "sm" | "md" | "lg";

const SIZE_CLASSES: Record<
  MarkSize,
  { disc: string; chip: string; glyph: string; letter: string }
> = {
  sm: { disc: "h-6 w-6", chip: "h-4 w-4", glyph: "h-2.5 w-2.5", letter: "text-xs" },
  md: { disc: "h-9 w-9", chip: "h-6 w-6", glyph: "h-3.5 w-3.5", letter: "text-[15px]" },
  lg: { disc: "h-14 w-14", chip: "h-9 w-9", glyph: "h-5 w-5", letter: "text-xl" },
};

export interface PlayerMarkProps {
  colour: Colour;
  size?: MarkSize;
}

// NFR-SYS-07: colour, shape and letter together, so a player is never told apart by colour alone.
export function PlayerMark({ colour, size = "md" }: PlayerMarkProps) {
  const { letter, shape, token } = PLAYER_IDENTITY[colour];
  const classes = SIZE_CLASSES[size];

  return (
    <span role="img" aria-label={COLOUR_NAMES[colour]} className="inline-flex items-center gap-1.5">
      <span
        style={{ backgroundColor: token }}
        className={`flex items-center justify-center rounded-full ${classes.disc}`}
      >
        {/* The inner chip keeps the shape readable on all four colours in both themes. */}
        <span
          className={`flex items-center justify-center rounded-full bg-panel text-high ${classes.chip}`}
        >
          <ShapeGlyph shape={shape} className={classes.glyph} />
        </span>
      </span>
      <span className={`font-semibold text-high ${classes.letter}`}>{letter}</span>
    </span>
  );
}
