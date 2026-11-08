import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";

const onConfirm = vi.fn();
const onCancel = vi.fn();

function Harness() {
  const [open, setOpen] = useState(true);
  return (
    <ConfirmDialog
      open={open}
      title="Leave this game?"
      body="Your progress in this game will be lost."
      confirmLabel="Leave"
      onConfirm={() => {
        onConfirm();
        setOpen(false);
      }}
      onCancel={() => {
        onCancel();
        setOpen(false);
      }}
    />
  );
}

function dialogElement(): HTMLDialogElement {
  const dialog = document.querySelector("dialog");
  if (!dialog) throw new Error("no dialog on the page");
  return dialog;
}

describe("ConfirmDialog (FR-SYS-08)", () => {
  beforeEach(() => {
    onConfirm.mockClear();
    onCancel.mockClear();
  });

  it("puts focus on Cancel first", () => {
    render(<Harness />);

    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Cancel" }));
  });

  // POST-08-1
  it("calls only onCancel, once, when Cancel is pressed", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
    expect(dialogElement().open).toBe(false);
  });

  // In a browser Esc closes the dialog itself, which is what dialog.close() does here.
  it("calls only onCancel, once, on Esc", () => {
    render(<Harness />);

    act(() => dialogElement().close());

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("calls only onConfirm when the danger action is pressed", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("button", { name: "Leave" }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });
});
