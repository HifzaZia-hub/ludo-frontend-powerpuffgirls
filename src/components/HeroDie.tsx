import { useRef, useState, type PointerEvent } from "react";
import { DieCube } from "@/components/DieCube";
import { FOCUS_RING } from "@/components/focusRing";
import { MAIN_TEXT } from "@/feedback/copy";

// The pose it rests in: seen from above and to the right, like the game's die.
const REST = { x: -18, y: -24 };
const DRAG_DEGREES_PER_PIXEL = 0.6;
// Below this many pixels, a press is a press and not a drag.
const DRAG_THRESHOLD = 4;

interface Turn {
  x: number;
  y: number;
}

interface Drag {
  pointerX: number;
  pointerY: number;
  start: Turn;
  moved: boolean;
}

// The front page's die: decoration you can play with. Drag it to turn it, or press it (mouse,
// touch, Enter or Space) and it spins two full turns and lands where it was. It is never a roll:
// it always shows the same faces, and nothing in the game reads it. Its slow idle turn, the
// spin and the orbit ring all stop with Animations Off or a reduced-motion preference.
export function HeroDie() {
  const [turn, setTurn] = useState<Turn>(REST);
  const [spinning, setSpinning] = useState(false);
  const [held, setHeld] = useState(false);
  const drag = useRef<Drag | null>(null);
  const justDragged = useRef(false);

  function spin() {
    setSpinning(true);
    setTurn((current) => ({ x: current.x + 360, y: current.y + 720 }));
  }

  function handlePointerDown(event: PointerEvent<HTMLButtonElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { pointerX: event.clientX, pointerY: event.clientY, start: turn, moved: false };
    setHeld(true);
  }

  function handlePointerMove(event: PointerEvent<HTMLButtonElement>) {
    const current = drag.current;
    if (!current) return;
    const dx = event.clientX - current.pointerX;
    const dy = event.clientY - current.pointerY;
    if (!current.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    current.moved = true;
    setSpinning(false); // follow the finger exactly, with no easing
    setTurn({
      x: current.start.x - dy * DRAG_DEGREES_PER_PIXEL,
      y: current.start.y + dx * DRAG_DEGREES_PER_PIXEL,
    });
  }

  function handlePointerUp() {
    justDragged.current = drag.current?.moved ?? false;
    drag.current = null;
    setHeld(false);
  }

  function handleClick() {
    // A drag ends with a click event too; only a press without a drag spins it.
    if (justDragged.current) {
      justDragged.current = false;
      return;
    }
    spin();
  }

  return (
    <button
      type="button"
      aria-label={MAIN_TEXT.spinDie}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onClick={handleClick}
      className={`die-scene hero-die block rounded-3xl ${held ? "is-held" : ""} ${FOCUS_RING}`}
    >
      <span aria-hidden="true" className="die-shadow" />
      <span className="hero-die-idle">
        <span aria-hidden="true" className="die-orbit" />
        <DieCube
          value={5}
          shaded={false}
          className={`hero-die-cube ${spinning ? "is-spinning" : ""}`}
          style={{
            transform: `translateZ(calc(var(--die) / -2)) rotateX(${turn.x}deg) rotateY(${turn.y}deg)`,
          }}
        />
      </span>
    </button>
  );
}
