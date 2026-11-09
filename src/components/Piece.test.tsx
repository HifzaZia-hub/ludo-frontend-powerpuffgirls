import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Piece, type PieceState } from "@/components/Piece";

describe("Piece", () => {
  // FR-SYS-03 POST-03-1
  it.each<PieceState>(["idle", "dimmed", "target"])("%s can't be pressed or focused", (state) => {
    render(<Piece colour="RED" state={state} label="Red piece 1" />);

    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByRole("img", { name: "Red piece 1" })).toBeTruthy();
  });

  it.each<PieceState>(["movable", "selected"])("%s is a real button", (state) => {
    render(<Piece colour="RED" state={state} label="Red piece 1" />);

    expect(screen.getByRole("button", { name: "Red piece 1" }).tagName).toBe("BUTTON");
  });

  it("says whether it is the chosen one", () => {
    const { rerender } = render(<Piece colour="RED" state="movable" label="Red piece 1" />);
    expect(screen.getByRole("button").getAttribute("aria-pressed")).toBe("false");

    rerender(<Piece colour="RED" state="selected" label="Red piece 1" />);
    expect(screen.getByRole("button").getAttribute("aria-pressed")).toBe("true");
  });

  it("reports a press", async () => {
    const onSelect = vi.fn();
    render(<Piece colour="RED" state="movable" label="Red piece 1" onSelect={onSelect} />);

    await userEvent.click(screen.getByRole("button"));

    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("reports the keyboard arriving", async () => {
    const onPreview = vi.fn();
    render(<Piece colour="RED" state="movable" label="Red piece 1" onPreview={onPreview} />);

    await userEvent.tab();

    expect(onPreview).toHaveBeenCalledTimes(1);
  });

  // NFR-SYS-08: still a button, so the keyboard keeps its place while a move is on its way.
  it("ignores presses while disabled but stays focusable", async () => {
    const onSelect = vi.fn();
    render(<Piece colour="RED" state="selected" label="Red piece 1" disabled onSelect={onSelect} />);
    const button = screen.getByRole("button");

    await userEvent.tab();
    await userEvent.click(button);

    expect(document.activeElement).toBe(button);
    expect(button.getAttribute("aria-disabled")).toBe("true");
    expect(onSelect).not.toHaveBeenCalled();
  });
});
