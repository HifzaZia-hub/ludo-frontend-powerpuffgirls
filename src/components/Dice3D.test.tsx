import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Dice } from "@/components/Dice";

// jsdom has no WebGL, so a stand-in takes the 3D die's place. It shows what it was given, and can
// be told to fail the way a computer without WebGL would.
const die3d = vi.hoisted(() => ({ fail: false }));
vi.mock("@/components/Die3D", () => ({
  Die3D: ({ face, rolling }: { face: number | null; rolling: boolean }) => {
    if (die3d.fail) throw new Error("no WebGL");
    return <span data-testid="die3d">{rolling ? "rolling" : String(face)}</span>;
  },
}));

afterEach(() => {
  die3d.fail = false;
  vi.restoreAllMocks();
});

describe("Dice in 3D", () => {
  it("draws the 3D die inside the same button, which still rolls from the keyboard", async () => {
    const onRoll = vi.fn();
    render(<Dice value={4} rolling={false} disabled={false} onRoll={onRoll} threeD />);

    expect((await screen.findByTestId("die3d")).textContent).toBe("4");
    const button = screen.getByRole("button", { name: "The dice shows 4. Roll the dice" });
    button.focus();
    await userEvent.keyboard("{Enter}");
    expect(onRoll).toHaveBeenCalledTimes(1);
  });

  // NFR-SYS-05: no number while it tumbles, as with the flat die.
  it("gives it no value while rolling", async () => {
    render(<Dice value={4} rolling disabled={false} onRoll={vi.fn()} threeD />);

    expect((await screen.findByTestId("die3d")).textContent).toBe("rolling");
  });

  it("falls back to the flat die when 3D can't draw", async () => {
    die3d.fail = true;
    vi.spyOn(console, "error").mockImplementation(() => undefined); // React reports the error it caught
    const { container } = render(
      <Dice value={4} rolling={false} disabled={false} onRoll={vi.fn()} threeD />,
    );

    await vi.waitFor(() => expect(container.querySelectorAll("[data-pip]")).toHaveLength(4));
    expect(screen.queryByTestId("die3d")).toBeNull();
  });

  it("stays flat without the setting", () => {
    const { container } = render(
      <Dice value={4} rolling={false} disabled={false} onRoll={vi.fn()} />,
    );

    expect(container.querySelectorAll("[data-pip]")).toHaveLength(4);
    expect(screen.queryByTestId("die3d")).toBeNull();
  });
});
