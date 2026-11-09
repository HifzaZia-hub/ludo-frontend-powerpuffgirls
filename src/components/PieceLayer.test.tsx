import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PieceLayer, type PieceChoice, type PieceEffects } from "@/components/PieceLayer";
import { cellKey, pieceCell, piecePlacement, stackOffsets } from "@/config/geometry";
import type { Colour, Piece } from "@/contract/types";

function makePiece(id: string, colour: Colour, step: number, boardSquare: number | null): Piece {
  return { id, colour, step, boardSquare };
}

function groupByCell(pieces: readonly Piece[]): ReadonlyMap<string, readonly Piece[]> {
  const cells = new Map<string, Piece[]>();
  for (const piece of pieces) {
    const key = cellKey(pieceCell(piece));
    cells.set(key, [...(cells.get(key) ?? []), piece]);
  }
  return cells;
}

function layer(pieces: readonly Piece[], safeSquares: readonly number[] = []) {
  return (
    <PieceLayer
      pieces={pieces}
      piecesByCell={groupByCell(pieces)}
      safeSquares={safeSquares}
      tweenSeconds={0}
    />
  );
}

function pieceElement(container: HTMLElement, id: string): HTMLElement {
  const found = container.querySelector<HTMLElement>(`[data-piece="${id}"]`);
  if (!found) throw new Error(`No element for piece ${id}`);
  return found;
}

const TRACK_PIECE = makePiece("R1", "RED", 3, 2);

describe("PieceLayer", () => {
  it("draws one piece for each piece it is given", () => {
    const pieces = [TRACK_PIECE, makePiece("Y1", "YELLOW", 0, null)];
    const { container } = render(layer(pieces));

    expect(container.querySelectorAll("[data-piece]")).toHaveLength(2);
  });

  it("puts a piece exactly where the geometry says", () => {
    const { container } = render(layer([TRACK_PIECE]));
    const expected = piecePlacement(pieceCell(TRACK_PIECE), { dx: 0, dy: 0, scale: 1 });

    const element = pieceElement(container, "R1");
    expect(parseFloat(element.style.left)).toBeCloseTo(expected.left);
    expect(parseFloat(element.style.top)).toBeCloseTo(expected.top);
    expect(parseFloat(element.style.width)).toBeCloseTo(expected.size);
  });

  it("fans out pieces that share a cell", () => {
    const first = makePiece("R1", "RED", 5, 4);
    const second = makePiece("R2", "RED", 5, 4);
    const { container } = render(layer([first, second]));
    const [leftOffset, rightOffset] = stackOffsets(2);
    if (!leftOffset || !rightOffset) throw new Error("two pieces get two offsets");
    const point = pieceCell(first);

    expect(parseFloat(pieceElement(container, "R1").style.left)).toBeCloseTo(
      piecePlacement(point, leftOffset).left,
    );
    expect(parseFloat(pieceElement(container, "R2").style.left)).toBeCloseTo(
      piecePlacement(point, rightOffset).left,
    );
  });

  it("keeps the same element when a piece moves, so it can't teleport", () => {
    const { container, rerender } = render(layer([TRACK_PIECE]));
    const before = pieceElement(container, "R1");
    const leftBefore = before.style.left;

    rerender(layer([{ ...TRACK_PIECE, step: 9, boardSquare: 8 }]));

    expect(pieceElement(container, "R1")).toBe(before);
    expect(before.style.left).not.toBe(leftBefore);
  });

  it.each([
    [2, false],
    [3, true],
  ])("with %i pieces on a cell, shows a count badge: %s", (count, shown) => {
    const pieces = Array.from({ length: count }, (_, index) =>
      makePiece(`G${index + 1}`, "GREEN", 6, 18),
    );
    const { container } = render(layer(pieces));

    const badge = container.querySelector("[data-stack-count]");
    expect(badge !== null).toBe(shown);
    if (shown) expect(badge?.textContent).toBe(String(count));
  });

  it.each([
    [makePiece("B2", "BLUE", 0, null), "Blue piece 2, in base"],
    [makePiece("R3", "RED", 3, 2), "Red piece 3, on the track"],
    [makePiece("G4", "GREEN", 53, null), "Green piece 4, in the home column"],
    [makePiece("Y1", "YELLOW", 57, null), "Yellow piece 1, home"],
  ])("labels %j for screen readers", (piece, label) => {
    render(layer([piece]));

    expect(screen.getByRole("img", { name: label })).toBeTruthy();
  });

  // NFR-SYS-11: which squares are safe comes from the rules it is given.
  it("says a piece is on a safe square only if the rules say so", () => {
    const { rerender } = render(layer([TRACK_PIECE], [2]));
    expect(screen.getByRole("img", { name: "Red piece 1, on the track, on a safe square" })).toBeTruthy();

    rerender(layer([TRACK_PIECE], [3]));
    expect(screen.getByRole("img", { name: "Red piece 1, on the track" })).toBeTruthy();
  });

  it("refuses a step outside the contract instead of guessing a cell", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(() => render(layer([makePiece("R1", "RED", 99, null)]))).toThrow(RangeError);

    vi.restoreAllMocks();
  });

  describe("choosing a move", () => {
    const R1 = makePiece("R1", "RED", 7, 6);
    const R2 = makePiece("R2", "RED", 20, 19);
    const G1 = makePiece("G1", "GREEN", 3, 15);
    const PIECES = [R1, R2, G1];
    const R1_MOVE = {
      pieceId: "R1",
      fromStep: 7,
      toStep: 10,
      captures: ["G1"],
      phrase: "move 3 squares and capture Hamza's piece",
    };

    function choosing(overrides: Partial<PieceChoice> = {}): PieceChoice {
      return {
        moves: [R1_MOVE],
        selected: null,
        locked: false,
        onPick: vi.fn(),
        onPreview: vi.fn(),
        ...overrides,
      };
    }

    function drawChoice(choice: PieceChoice) {
      return render(
        <PieceLayer
          pieces={PIECES}
          piecesByCell={groupByCell(PIECES)}
          safeSquares={[]}
          tweenSeconds={0}
          choice={choice}
        />,
      );
    }

    function stateOf(container: HTMLElement, id: string): string | null | undefined {
      return pieceElement(container, id).querySelector("[data-state]")?.getAttribute("data-state");
    }

    // FR-SYS-03 POST-03-1
    it("makes a button of the listed pieces only, and dims the rest", () => {
      const { container } = drawChoice(choosing());

      expect(screen.getAllByRole("button")).toHaveLength(1);
      expect(stateOf(container, "R1")).toBe("movable");
      expect(stateOf(container, "R2")).toBe("dimmed");
      expect(stateOf(container, "G1")).toBe("dimmed");
    });

    it("keeps a movable piece above one that can't move", () => {
      const { container } = drawChoice(choosing());

      expect(pieceElement(container, "R1").className).toContain("z-[5]");
      expect(pieceElement(container, "G1").className).not.toContain("z-[5]");
    });

    it("draws everything plainly when there is nothing to choose", () => {
      const { container } = render(layer(PIECES));

      expect(screen.queryAllByRole("button")).toHaveLength(0);
      expect(stateOf(container, "R2")).toBe("idle");
    });

    it("says what a movable piece would do", () => {
      drawChoice(choosing());

      expect(
        screen.getByRole("button", {
          name: "Red piece 1, on the track, can move 3 squares and capture Hamza's piece",
        }),
      ).toBeTruthy();
    });

    it("shows no destination until a piece is chosen", () => {
      const { container } = drawChoice(choosing());

      expect(container.querySelector("[data-destination]")).toBeNull();
    });

    // FR-18: the marker goes where the server's toStep says.
    it("marks the server's destination for the chosen piece", () => {
      const { container } = drawChoice(choosing({ selected: R1_MOVE }));
      const marker = container.querySelector<HTMLElement>("[data-destination]");
      const expected = piecePlacement(pieceCell({ ...R1, step: 10 }), { dx: 0, dy: 0, scale: 1 });

      expect(parseFloat(marker?.style.left ?? "")).toBeCloseTo(expected.left);
      expect(parseFloat(marker?.style.top ?? "")).toBeCloseTo(expected.top);
    });

    // The marker is drawn for the eye. The piece's own label already says this in words.
    it("hides the marker from screen readers", () => {
      const { container } = drawChoice(choosing({ selected: R1_MOVE }));

      expect(container.querySelector("[data-destination]")?.getAttribute("aria-hidden")).toBe("true");
    });

    it("marks the piece the chosen move would capture, in words too", () => {
      const { container } = drawChoice(choosing({ selected: R1_MOVE }));

      expect(stateOf(container, "R1")).toBe("selected");
      expect(stateOf(container, "G1")).toBe("target");
      expect(screen.getByRole("img", { name: "Green piece 1, on the track, would be captured" })).toBeTruthy();
    });

    it("doesn't mark a capture before that move is chosen", () => {
      const { container } = drawChoice(choosing());

      expect(stateOf(container, "G1")).toBe("dimmed");
    });

    it("passes on a press with the piece's id", async () => {
      const onPick = vi.fn();
      drawChoice(choosing({ onPick }));

      await userEvent.click(screen.getByRole("button"));

      expect(onPick).toHaveBeenCalledWith("R1");
    });

    it("ignores presses while locked", async () => {
      const onPick = vi.fn();
      drawChoice(choosing({ onPick, locked: true }));

      await userEvent.click(screen.getByRole("button"));

      expect(onPick).not.toHaveBeenCalled();
    });
  });

  describe("event effects", () => {
    const CAPTURED = makePiece("G1", "GREEN", 0, null);
    const ALONE = { dx: 0, dy: 0, scale: 1 };
    const NO_EFFECTS = {
      held: new Map<string, number>(),
      flashingId: null,
      returningId: null,
      finishingId: null,
      returnSeconds: 0,
    };

    function draw(effects: PieceEffects) {
      return render(
        <PieceLayer
          pieces={[CAPTURED]}
          piecesByCell={groupByCell([CAPTURED])}
          safeSquares={[]}
          tweenSeconds={0}
          effects={effects}
        />,
      );
    }

    it("keeps a captured piece on its old square until its turn", () => {
      const { container } = draw({ ...NO_EFFECTS, held: new Map([["G1", 14]]) });
      const expected = piecePlacement(pieceCell({ ...CAPTURED, step: 14 }), ALONE);

      expect(parseFloat(pieceElement(container, "G1").style.left)).toBeCloseTo(expected.left);
      expect(parseFloat(pieceElement(container, "G1").style.top)).toBeCloseTo(expected.top);
    });

    it("draws it in its base once it is let go", () => {
      const { container } = draw(NO_EFFECTS);
      const expected = piecePlacement(pieceCell(CAPTURED), ALONE);

      expect(parseFloat(pieceElement(container, "G1").style.left)).toBeCloseTo(expected.left);
    });

    it("keeps describing where the piece really is while it is held", () => {
      draw({ ...NO_EFFECTS, held: new Map([["G1", 14]]) });

      expect(screen.getByRole("img", { name: "Green piece 1, in base" })).toBeTruthy();
    });

    it("flashes the captured piece, above the piece that took it", () => {
      const { container } = draw({ ...NO_EFFECTS, flashingId: "G1", held: new Map([["G1", 14]]) });

      expect(container.querySelector('[data-effect="capture"]')).not.toBeNull();
      expect(pieceElement(container, "G1").className).toContain("z-10");
    });

    it("makes a finishing piece glow", () => {
      const { container } = draw({ ...NO_EFFECTS, finishingId: "G1" });

      expect(container.querySelector('[data-effect="finish"]')).not.toBeNull();
    });
  });

  describe("walking", () => {
    const WALKER = makePiece("R1", "RED", 10, 9);

    function drawWalk(walk: { pieceId: string; step: number } | null) {
      return (
        <PieceLayer
          pieces={[WALKER]}
          piecesByCell={groupByCell([WALKER])}
          safeSquares={[]}
          tweenSeconds={0}
          walk={walk}
          walkSeconds={0}
        />
      );
    }

    it("draws a walking piece on the square it has reached", () => {
      const { container } = render(drawWalk({ pieceId: "R1", step: 8 }));
      const expected = piecePlacement(pieceCell({ ...WALKER, step: 8 }), { dx: 0, dy: 0, scale: 1 });

      expect(parseFloat(pieceElement(container, "R1").style.left)).toBeCloseTo(expected.left);
      expect(parseFloat(pieceElement(container, "R1").style.top)).toBeCloseTo(expected.top);
    });

    it("draws the walking piece above the others", () => {
      const { container } = render(drawWalk({ pieceId: "R1", step: 8 }));

      expect(pieceElement(container, "R1").className).toContain("z-10");
    });

    // The snapshot always wins.
    it("settles exactly on the snapshot's square when the walk ends", () => {
      const { container, rerender } = render(drawWalk({ pieceId: "R1", step: 8 }));

      rerender(drawWalk(null));

      const expected = piecePlacement(pieceCell(WALKER), { dx: 0, dy: 0, scale: 1 });
      expect(parseFloat(pieceElement(container, "R1").style.left)).toBeCloseTo(expected.left);
      expect(pieceElement(container, "R1").className).not.toContain("z-10");
    });

    it("keeps describing where the piece really is", () => {
      render(drawWalk({ pieceId: "R1", step: 8 }));

      expect(screen.getByRole("img", { name: "Red piece 1, on the track" })).toBeTruthy();
    });
  });
});
