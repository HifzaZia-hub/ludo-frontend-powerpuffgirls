import { forwardRef, type ButtonHTMLAttributes, type MouseEvent } from "react";
import { FOCUS_RING } from "@/components/focusRing";

type ButtonVariant = "primary" | "outline" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "bg-accent text-on-accent active:bg-accent-press",
  outline: "border border-soft text-high active:bg-raised",
  ghost: "text-mid active:bg-raised",
  danger: "bg-danger text-on-danger",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "gap-1 px-3 py-1 text-xs",
  md: "gap-2 px-5 py-2 text-[15px]",
  lg: "gap-2 px-8 py-3 text-[15px]",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  pending?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    pending = false,
    type = "button",
    className = "",
    children,
    onClick,
    ...rest
  },
  ref,
) {
  // NFR-SYS-08: aria-disabled rather than disabled, because a disabled button drops keyboard
  // focus and the player would lose their place while the request is in flight.
  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    if (pending) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  }

  return (
    <button
      {...rest}
      ref={ref}
      type={type}
      onClick={handleClick}
      aria-busy={pending || undefined}
      aria-disabled={pending || undefined}
      className={`inline-flex items-center justify-center rounded-full font-semibold transition-transform duration-[80ms] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${FOCUS_RING} ${className}`}
    >
      {/* NFR-SYS-01: the spinner is plain CSS, so it shows on the very next paint. */}
      {pending && (
        <span
          aria-hidden="true"
          data-spinner=""
          className="h-[1em] w-[1em] animate-spin rounded-full border-2 border-current border-r-transparent"
        />
      )}
      {children}
    </button>
  );
});
