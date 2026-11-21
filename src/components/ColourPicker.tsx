import { useRef, type KeyboardEvent } from "react";
import { FOCUS_RING } from "@/components/focusRing";
import { PlayerMark } from "@/components/PlayerMark";
import type { Colour } from "@/contract/types";
import { COLOUR_NAMES } from "@/feedback/copy";
import { nextOptionIndex } from "@/interaction/arrowKeys";

export interface ColourPickerProps {
  label: string;
  /** The colours on offer, in the order shown. */
  colours: readonly Colour[];
  value: Colour | null;
  onChange: (colour: Colour) => void;
  disabled?: boolean;
}

// FR-SYS-01, D2 FR-06. NFR-SYS-07: each choice shows its letter and shape as well as its colour,
// and a tick marks the chosen one. NFR-SYS-08: Tab lands on the chosen colour, and the arrow keys
// move between them.
export function ColourPicker({
  label,
  colours,
  value,
  onChange,
  disabled = false,
}: ColourPickerProps) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  // With nothing chosen yet, Tab still needs somewhere to land.
  const tabStop = value !== null && colours.includes(value) ? value : colours[0];

  function handleKeyDown(event: KeyboardEvent, index: number) {
    const next = nextOptionIndex(event.key, index, colours.length);
    const colour = next === null ? undefined : colours[next];
    if (next === null || colour === undefined) return;
    event.preventDefault();
    onChange(colour);
    buttons.current[next]?.focus();
  }

  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {colours.map((colour, index) => {
        const selected = colour === value;
        return (
          <button
            key={colour}
            ref={(element) => {
              buttons.current[index] = element;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={COLOUR_NAMES[colour]}
            tabIndex={colour === tabStop ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(colour)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-[15px] font-semibold active:bg-raised disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING} ${
              selected ? "bg-raised text-high ring-1 ring-mid" : "text-mid"
            }`}
          >
            <PlayerMark colour={colour} size="sm" />
            <span>{COLOUR_NAMES[colour]}</span>
            {selected && <span aria-hidden="true">✓</span>}
          </button>
        );
      })}
    </div>
  );
}
