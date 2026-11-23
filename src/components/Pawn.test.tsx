import { render } from "@testing-library/react";
import { Pawn } from "@/components/Pawn";
import { COLOURS, PLAYER_IDENTITY } from "@/config/players";

describe("Pawn (NFR-SYS-07)", () => {
  it.each(COLOURS)(
    "prints %s's own shape on the body, so it isn't told apart by colour alone",
    (colour) => {
      const { container } = render(<Pawn colour={colour} />);

      const emblems = container.querySelectorAll("[data-emblem]");
      expect(emblems).toHaveLength(1);
      expect(emblems[0]?.getAttribute("data-emblem")).toBe(PLAYER_IDENTITY[colour].shape);
    },
  );

  it("draws the shape light on the body, not as a dark mark", () => {
    const { container } = render(<Pawn colour="YELLOW" />);
    const face = container.querySelector<SVGGElement>("[data-emblem] > g:last-child");

    expect(face?.style.fill).toBe("var(--board-cell)");
  });

  it("leaves the shape off only when asked, for places where a mark beside it says whose it is", () => {
    const { container } = render(<Pawn colour="RED" badge={false} />);

    expect(container.querySelector("[data-emblem]")).toBeNull();
  });

  it("is hidden from screen readers, as whatever shows it gives the name", () => {
    const { container } = render(<Pawn colour="BLUE" />);

    expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });
});
