import { forwardRef, useId, type InputHTMLAttributes } from "react";
import { FOCUS_RING } from "@/components/focusRing";
import { Icon, type IconName } from "@/components/Icon";

export interface TextFieldProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange"
> {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  /** A small icon before the label. Decoration only. */
  icon?: IconName;
}

// FR-SYS-01 ALT-01-1: the value belongs to the parent and an error never touches it, so a
// rejected form keeps what the player typed.
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, value, onChange, error, icon, className = "", ...rest },
  ref,
) {
  const inputId = useId();
  const errorId = useId();

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label
        htmlFor={inputId}
        className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-mid"
      >
        {icon && <Icon name={icon} className="h-4 w-4" />}
        {label}
      </label>
      <input
        {...rest}
        ref={ref}
        id={inputId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={`rounded-xl border bg-raised px-4 py-2.5 text-[15px] text-high disabled:cursor-not-allowed disabled:opacity-50 ${
          error ? "border-danger" : "border-soft"
        } ${FOCUS_RING}`}
      />
      {/* The space is kept even with no error, so showing one doesn't push the form down. */}
      <p id={errorId} className="min-h-[1.25rem] text-xs text-danger">
        {error}
      </p>
    </div>
  );
});
