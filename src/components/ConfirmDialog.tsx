import { useRef } from "react";
import { Button } from "@/components/Button";
import { Modal } from "@/components/Modal";
import { LABELS } from "@/feedback/copy";

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

// FR-SYS-08 POST-08-1: Cancel and Esc only ever call onCancel, and Cancel has focus first so an
// accidental Enter can't throw a game away.
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  pending = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  return (
    <Modal
      open={open}
      title={title}
      onClose={onCancel}
      initialFocusRef={cancelRef}
      showClose={false}
    >
      <p className="text-[15px] text-mid">{body}</p>
      <div className="mt-6 flex justify-end gap-2">
        <Button ref={cancelRef} variant="outline" onClick={onCancel}>
          {LABELS.cancel}
        </Button>
        <Button variant="danger" pending={pending} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
