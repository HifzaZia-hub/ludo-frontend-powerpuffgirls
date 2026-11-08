import { useRef, type KeyboardEvent } from "react";
import { FOCUS_RING } from "@/components/focusRing";
import { nextOptionIndex } from "@/interaction/arrowKeys";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedControlProps<T extends string> {
  label: string;
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
}

export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  disabled = false,
}: SegmentedControlProps<T>) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  function handleKeyDown(event: KeyboardEvent, index: number) {
    const next = nextOptionIndex(event.key, index, options.length);
    const option = next === null ? undefined : options[next];
    if (next === null || !option) return;
    event.preventDefault();
    onChange(option.value);
    buttons.current[next]?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex gap-1 rounded-full border border-soft bg-panel p-1"
    >
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            ref={(element) => {
              buttons.current[index] = element;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            // NFR-SYS-08: Tab lands on the chosen option, and arrow keys move between them.
            tabIndex={selected ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={`rounded-full px-4 py-1 text-xs font-semibold active:bg-raised disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING} ${
              selected ? "bg-raised text-high ring-1 ring-mid" : "text-mid"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
