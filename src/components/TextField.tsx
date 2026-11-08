import { useId, type InputHTMLAttributes } from "react";
import { FOCUS_RING } from "@/components/focusRing";

export interface TextFieldProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange"
> {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
}

// FR-SYS-01 ALT-01-1: the value belongs to the parent and an error never touches it, so a
// rejected form keeps what the player typed.
export function TextField({
  label,
  value,
  onChange,
  error,
  className = "",
  ...rest
}: TextFieldProps) {
  const inputId = useId();
  const errorId = useId();

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label htmlFor={inputId} className="text-xs font-semibold uppercase text-mid">
        {label}
      </label>
      <input
        {...rest}
        id={inputId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={`rounded-lg border bg-raised px-3 py-2 text-[15px] text-high disabled:cursor-not-allowed disabled:opacity-50 ${
          error ? "border-danger" : "border-soft"
        } ${FOCUS_RING}`}
      />
      {/* The space is kept even with no error, so showing one doesn't push the form down. */}
      <p id={errorId} className="min-h-[1.25rem] text-xs text-danger">
        {error}
      </p>
    </div>
  );
}
