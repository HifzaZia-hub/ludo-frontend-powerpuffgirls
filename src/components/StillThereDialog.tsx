import { Button } from "@/components/Button";
import { Modal } from "@/components/Modal";
import { CONNECTION_TEXT } from "@/feedback/copy";

export interface StillThereDialogProps {
  open: boolean;
  onDismiss: () => void;
}

export function StillThereDialog({ open, onDismiss }: StillThereDialogProps) {
  return (
    <Modal open={open} title={CONNECTION_TEXT.stillThereTitle} onClose={onDismiss} showClose={false}>
      <p className="text-[15px] text-mid">{CONNECTION_TEXT.stillThereBody}</p>
      <div className="mt-6 flex justify-end">
        <Button onClick={onDismiss}>{CONNECTION_TEXT.stillHere}</Button>
      </div>
    </Modal>
  );
}
