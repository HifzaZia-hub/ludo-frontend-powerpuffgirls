import type { ReactNode } from "react";

export interface FormRowProps {
  label: string;
  children: ReactNode;
}

// For controls that already carry their own aria-label, such as SegmentedControl. The visible
// label is hidden from screen readers so it isn't read out twice.
export function FormRow({ label, children }: FormRowProps) {
  return (
    <div className="flex flex-col items-start gap-1">
      <span aria-hidden="true" className="text-xs font-semibold uppercase text-mid">
        {label}
      </span>
      {children}
    </div>
  );
}
