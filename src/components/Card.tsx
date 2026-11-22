import type { HTMLAttributes } from "react";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  active?: boolean;
}

export function Card({ active = false, className = "", children, ...rest }: CardProps) {
  return (
    <div
      {...rest}
      className={`glow-panel rounded-2xl bg-panel p-4 ${
        active ? "-translate-y-0.5 shadow-lg ring-2 ring-accent" : ""
      } transition-transform duration-150 ${className}`}
    >
      {children}
    </div>
  );
}
