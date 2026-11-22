import { useRef, type KeyboardEvent } from "react";
import { FOCUS_RING } from "@/components/focusRing";
import { Icon, type IconName } from "@/components/Icon";
import { nextOptionIndex } from "@/interaction/arrowKeys";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  /** A small icon before the label. Decoration only. */
  icon?: IconName;
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
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
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
            // NFR-SYS-07: the chosen one has a brighter border, a tint and brighter text, not only
            // a different colour, and aria-checked says it.
            className={`inline-flex min-w-[3rem] items-center justify-center gap-2 rounded-full border-2 px-4 py-1.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING} ${
              selected
                ? "border-accent bg-[color-mix(in_oklab,var(--accent)_14%,transparent)] text-high shadow-[0_0_14px_var(--glow)]"
                : "border-soft bg-raised text-mid active:bg-panel"
            }`}
          >
            {option.icon && (
              <Icon
                name={option.icon}
                className={`h-4 w-4 ${selected ? "text-[var(--title-accent)]" : ""}`}
              />
            )}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
