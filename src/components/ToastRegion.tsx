import { Toast, type ToastKind } from "@/components/Toast";

export interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

export interface ToastRegionProps {
  toasts: readonly ToastItem[];
  onDismiss: (id: number) => void;
}

// Fixed in a corner so a new message never moves anything on the page. The list is always there
// because screen readers only announce changes to a live region that already exists.
export function ToastRegion({ toasts, onDismiss }: ToastRegionProps) {
  return (
    <ol
      aria-live="polite"
      className="fixed bottom-4 right-4 z-50 flex w-[min(92vw,24rem)] flex-col gap-2"
    >
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          kind={toast.kind}
          message={toast.message}
          onDismiss={() => onDismiss(toast.id)}
        />
      ))}
    </ol>
  );
}
