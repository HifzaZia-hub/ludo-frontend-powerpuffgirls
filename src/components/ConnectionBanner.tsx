import { Button } from "@/components/Button";
import { CONNECTION_TEXT } from "@/feedback/copy";

export interface ConnectionBannerProps {
  status: "reconnecting" | "lost" | null;
  onRetry: () => void;
}

// Floats over the page, so appearing never moves the board. The wrapper is always there because
// screen readers only announce changes to a live region that already exists.
export function ConnectionBanner({ status, onRetry }: ConnectionBannerProps) {
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-2 z-50 flex justify-center px-4">
      {status !== null && (
        <p
          data-connection={status}
          className={`pointer-events-auto flex items-center gap-3 rounded-full border-2 bg-panel px-5 py-2 text-[15px] font-semibold text-high shadow-lg ${
            status === "lost" ? "border-danger" : "border-warning"
          }`}
        >
          {/* NFR-SYS-07: the spinner and the words carry this as well as the border colour. */}
          {status === "reconnecting" && (
            <span
              aria-hidden="true"
              className="h-[1em] w-[1em] animate-spin rounded-full border-2 border-current border-r-transparent"
            />
          )}
          {status === "lost" ? CONNECTION_TEXT.lost : CONNECTION_TEXT.reconnecting}
          {status === "lost" && (
            <Button variant="outline" size="sm" onClick={onRetry}>
              {CONNECTION_TEXT.tryAgain}
            </Button>
          )}
        </p>
      )}
    </div>
  );
}
