import type { ReactNode } from "react";
import { GAME_TEXT } from "@/feedback/copy";

export interface BoardProps {
  children: ReactNode;
  className?: string;
}

// FR-SYS-09: the outer box takes whatever space the layout gives it, so it must be sized from
// outside. The square inside is then as large as fits in both directions.
export function Board({ children, className = "" }: BoardProps) {
  return (
    <section
      aria-label={GAME_TEXT.board}
      className={`flex items-center justify-center [container-type:size] ${className}`}
    >
      <div className="relative aspect-square w-[min(100cqi,100cqb)] overflow-hidden rounded-2xl border-2 border-board-line bg-board-cell">
        {children}
      </div>
    </section>
  );
}
