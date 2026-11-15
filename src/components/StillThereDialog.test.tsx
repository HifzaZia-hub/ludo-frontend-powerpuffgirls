import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StillThereDialog } from "@/components/StillThereDialog";

describe("StillThereDialog", () => {
  it("is closed unless asked", () => {
    render(<StillThereDialog open={false} onDismiss={vi.fn()} />);

    expect(screen.queryByRole("heading", { name: "Still there?" })).toBeNull();
  });

  it("says what happened, and can be dismissed", async () => {
    const onDismiss = vi.fn();
    render(<StillThereDialog open onDismiss={onDismiss} />);

    expect(screen.getByText("The computer has been playing your turns.")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "I'm here" }));

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
