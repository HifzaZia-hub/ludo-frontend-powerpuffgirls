import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HeroDie } from "@/components/HeroDie";

const die = () => screen.getByRole("button", { name: "Spin the die" });
const cube = () => die().querySelector<HTMLElement>(".hero-die-cube");

// jsdom has no pointer capture, and its pointer events drop the pointer's position. Browsers have
// both, so these stand in for them here.
class TestPointerEvent extends MouseEvent {
  readonly pointerId: number;
  readonly pointerType: string;
  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init);
    this.pointerId = init.pointerId ?? 1;
    this.pointerType = init.pointerType ?? "mouse";
  }
}

const realPointerEvent = window.PointerEvent;

beforeAll(() => {
  window.PointerEvent = TestPointerEvent as unknown as typeof PointerEvent;
  HTMLElement.prototype.setPointerCapture = () => undefined;
});

afterAll(() => {
  window.PointerEvent = realPointerEvent;
});

describe("HeroDie", () => {
  it("spins two full turns when pressed, ending where it started", async () => {
    const user = userEvent.setup();
    render(<HeroDie />);

    await user.click(die());

    expect(cube()?.classList.contains("is-spinning")).toBe(true);
    expect(cube()?.style.transform).toContain("rotateX(342deg) rotateY(696deg)");
  });

  // NFR-SYS-08: a real button, so the keyboard can spin it too.
  it("spins from the keyboard", async () => {
    const user = userEvent.setup();
    render(<HeroDie />);

    die().focus();
    await user.keyboard("{Enter}");

    expect(cube()?.classList.contains("is-spinning")).toBe(true);
  });

  it("turns with a drag, and a drag doesn't also spin it", () => {
    render(<HeroDie />);
    const button = die();

    fireEvent.pointerDown(button, { clientX: 100, clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(button, { clientX: 150, clientY: 100, pointerId: 1 });
    fireEvent.pointerUp(button, { clientX: 150, clientY: 100, pointerId: 1 });
    fireEvent.click(button);

    expect(cube()?.style.transform).toContain("rotateY(6deg)"); // -24 + 50 px * 0.6
    expect(cube()?.classList.contains("is-spinning")).toBe(false);
  });

  // NFR-SYS-05: it always shows the same faces; it is never a roll.
  it("is decoration, not a roll", () => {
    const { container } = render(<HeroDie />);

    expect(container.querySelectorAll("[data-pip]")).toHaveLength(0);
  });
});
