import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MoveList, type MoveListProps } from "@/components/MoveList";

const MOVES = [
  { pieceId: "R2", number: "2", phrase: "move 3 squares" },
  { pieceId: "R4", number: "4", phrase: "reach home" },
];

function setup(overrides: Partial<MoveListProps> = {}) {
  const props: MoveListProps = {
    moves: MOVES,
    selectedId: null,
    locked: false,
    sending: false,
    onPick: vi.fn(),
    onPreview: vi.fn(),
    onConfirm: vi.fn(),
    ...overrides,
  };
  render(<MoveList {...props} />);
  return props;
}

function card(name: string): HTMLElement {
  return screen.getByRole("button", { name });
}

function moveButton(): HTMLButtonElement {
  return screen.getByRole<HTMLButtonElement>("button", { name: "Move" });
}

describe("MoveList", () => {
  it("has one card per move, in simple words", () => {
    setup();

    expect(card("Piece 2 → move 3 squares")).toBeTruthy();
    expect(card("Piece 4 → reach home")).toBeTruthy();
  });

  it("reports a press on a card", async () => {
    const { onPick } = setup();

    await userEvent.click(card("Piece 4 → reach home"));

    expect(onPick).toHaveBeenCalledWith("R4");
  });

  it("reports the keyboard arriving on a card", async () => {
    const { onPreview } = setup();

    await userEvent.tab();

    expect(onPreview).toHaveBeenCalledWith("R2");
  });

  // NFR-SYS-07: not by the border colour alone.
  it("marks the chosen card with a tick as well", () => {
    setup({ selectedId: "R2" });

    const chosen = screen.getByRole("button", { name: /Piece 2/ });
    expect(chosen.getAttribute("aria-pressed")).toBe("true");
    expect(chosen.textContent).toContain("✓");
    expect(screen.getByRole("button", { name: /Piece 4/ }).textContent).not.toContain("✓");
  });

  it("can't send until a piece is chosen", () => {
    setup();

    expect(moveButton().disabled).toBe(true);
  });

  it("sends the chosen piece", async () => {
    const { onConfirm } = setup({ selectedId: "R2" });

    await userEvent.click(moveButton());

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  // NFR-SYS-01
  it("shows pending at once and ignores further presses", async () => {
    const { onConfirm, onPick } = setup({ selectedId: "R2", locked: true, sending: true });

    await userEvent.click(moveButton());
    await userEvent.click(screen.getByRole("button", { name: /Piece 4/ }));

    expect(moveButton().getAttribute("aria-busy")).toBe("true");
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onPick).not.toHaveBeenCalled();
  });

  it("can't send while locked for any other reason", () => {
    setup({ selectedId: "R2", locked: true });

    expect(moveButton().disabled).toBe(true);
  });
});
