import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/Icon";

export interface FormRowProps {
  label: string;
  /** A small icon before the label. Decoration only. */
  icon?: IconName;
  children: ReactNode;
}

// For controls that already carry their own aria-label, such as SegmentedControl. The visible
// label is hidden from screen readers so it isn't read out twice.
export function FormRow({ label, icon, children }: FormRowProps) {
  return (
    <div className="flex flex-col items-start gap-2">
      <span
        aria-hidden="true"
        className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-mid"
      >
        {icon && <Icon name={icon} className="h-4 w-4" />}
        {label}
      </span>
      {children}
    </div>
  );
}
