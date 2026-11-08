import { useEffect, useId, useRef, type ReactNode, type RefObject } from "react";
import { Button } from "@/components/Button";
import { LABELS } from "@/feedback/copy";

export interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Gets focus when the modal opens. Without it, the browser picks the first control. */
  initialFocusRef?: RefObject<HTMLElement>;
  showClose?: boolean;
}

// A native <dialog> opened with showModal(), so the browser makes the page inert, keeps focus
// inside, closes on Esc and hands focus back to the opener. None of that is hand-written here.
export function Modal({
  open,
  title,
  onClose,
  children,
  initialFocusRef,
  showClose = true,
}: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      initialFocusRef?.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open, initialFocusRef]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      // If `open` is still true the browser closed it (Esc or a back gesture), so tell the parent.
      // If `open` is already false the parent closed it, and calling back would count twice.
      onClose={() => {
        if (open) onClose();
      }}
      className="m-auto w-[min(92vw,28rem)] rounded-2xl border border-soft bg-panel p-6 text-high"
    >
      {open && (
        <>
          <div className="mb-3 flex items-start justify-between gap-4">
            <h2 id={titleId} className="text-xl font-semibold">
              {title}
            </h2>
            {showClose && (
              <Button variant="ghost" size="sm" onClick={onClose}>
                {LABELS.close}
              </Button>
            )}
          </div>
          {children}
        </>
      )}
    </dialog>
  );
}
