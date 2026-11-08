import { FOCUS_RING } from "@/components/focusRing";
import { LABELS } from "@/feedback/copy";

export interface ToggleProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function Toggle({ label, checked, onChange, disabled = false }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`inline-flex items-center gap-3 rounded-full text-[15px] text-high disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING}`}
    >
      <span>{label}</span>
      <span
        className={`flex h-6 w-11 items-center rounded-full border border-soft p-0.5 ${
          checked ? "bg-accent" : "bg-raised"
        }`}
      >
        <span
          className={`h-[18px] w-[18px] rounded-full transition-transform duration-150 ${
            checked ? "translate-x-5 bg-on-accent" : "bg-high"
          }`}
        />
      </span>
      {/* NFR-SYS-07: the word says the state, so it doesn't rely on the track's colour. */}
      <span className="w-7 text-left text-xs font-semibold text-mid">
        {checked ? LABELS.on : LABELS.off}
      </span>
    </button>
  );
}
