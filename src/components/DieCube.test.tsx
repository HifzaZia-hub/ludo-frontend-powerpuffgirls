import { render } from "@testing-library/react";
import { DieCube } from "@/components/DieCube";

const allPips = (container: HTMLElement) => container.querySelectorAll(".die-pip").length;
const valuePips = (container: HTMLElement) => container.querySelectorAll("[data-pip]").length;

describe("DieCube", () => {
  // A real die: 1 + 2 + 3 + 4 + 5 + 6 pips over its six faces.
  it("draws every face, like a real die", () => {
    const { container } = render(<DieCube value={4} />);

    expect(container.querySelectorAll(".die-face")).toHaveLength(6);
    expect(allPips(container)).toBe(21);
  });

  // NFR-SYS-05: only the face showing the given value is marked as the value.
  it.each([1, 2, 3, 4, 5, 6])("marks only the %i facing the player as the value", (value) => {
    const { container } = render(<DieCube value={value} markValue />);

    expect(valuePips(container)).toBe(value);
  });

  it("turns so the given value faces the player", () => {
    const { container } = render(<DieCube value={6} />);
    const cube = container.firstElementChild as HTMLElement;

    expect(cube.style.getPropertyValue("--face-turn")).toBe("rotateY(180deg)");
  });

  // While it tumbles there is no value yet, so no face shows any pips.
  it("is blank on every face with no value", () => {
    const { container } = render(<DieCube value={null} markValue />);

    expect(allPips(container)).toBe(0);
  });

  // The class names are written out in full, or Tailwind would drop their rules.
  it("gives every face its own side", () => {
    const { container } = render(<DieCube value={1} />);
    const sides = [...container.querySelectorAll(".die-face")].map(
      (face) => [...face.classList].find((name) => name.startsWith("die-face--")) ?? "",
    );

    expect(sides.sort()).toEqual([
      "die-face--back",
      "die-face--bottom",
      "die-face--front",
      "die-face--left",
      "die-face--right",
      "die-face--top",
    ]);
  });
});
