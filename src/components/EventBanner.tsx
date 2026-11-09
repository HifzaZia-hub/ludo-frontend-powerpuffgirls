export interface EventBannerProps {
  text: string | null;
}

// On top of the board, so appearing never moves anything else. Hidden from screen readers
// because the message log already announces the same event in words.
export function EventBanner({ text }: EventBannerProps) {
  if (text === null) return null;
  return (
    <p
      aria-hidden="true"
      data-banner=""
      className="pointer-events-none absolute left-1/2 top-1/2 z-30 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border border-soft bg-panel px-5 py-2 text-[15px] font-bold text-high shadow-lg"
    >
      {text}
    </p>
  );
}
