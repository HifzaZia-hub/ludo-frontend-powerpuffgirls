import type { HTMLAttributes } from "react";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  active?: boolean;
}

export function Card({ active = false, className = "", children, ...rest }: CardProps) {
  return (
    <div
      {...rest}
      className={`glow-panel relative rounded-2xl bg-panel p-4 ${
        active ? "turn-pulse -translate-y-0.5 shadow-lg ring-2 ring-accent" : ""
      } transition-[transform,--spot] duration-300 ${className}`}
    >
      {children}
    </div>
  );
}
