import { forwardRef, type ButtonHTMLAttributes, type MouseEvent } from "react";
import { FOCUS_RING } from "@/components/focusRing";

type ButtonVariant = "primary" | "outline" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "btn-sheen bg-accent text-on-accent shadow-[0_0_18px_color-mix(in_oklab,var(--accent)_45%,transparent)] hover:shadow-[0_0_30px_color-mix(in_oklab,var(--accent)_65%,transparent)] active:bg-accent-press",
  outline:
    "border border-soft text-high hover:border-[var(--panel-edge)] hover:bg-raised hover:shadow-[0_0_16px_var(--glow)] active:bg-raised",
  ghost: "text-mid hover:text-high active:bg-raised",
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
      // NFR-SYS-01: it lifts under the pointer and presses down at once when clicked.
      className={`group relative inline-flex items-center justify-center overflow-hidden rounded-full font-semibold transition-[transform,box-shadow,background-color,border-color,color] duration-150 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.97] active:duration-[80ms] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 aria-disabled:hover:translate-y-0 ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${FOCUS_RING} ${className}`}
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
