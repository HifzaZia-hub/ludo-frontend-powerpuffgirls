import { NINE_SPOTS, PIP_SPOTS } from "@/config/diceFaces";

export interface DiceFaceProps {
  /** The server's value, or null while rolling. */
  face: number | null;
  rolling: boolean;
}

const PLAIN_FACES = ["back", "left", "right", "top", "bottom"];

// The die, drawn as a cube in CSS (theme.css .die-*), so it needs no 3D library.
// NFR-SYS-05: blank while it tumbles, then exactly the server's value on the front face.
// The other faces carry no pips, so the die never shows a number the server didn't send.
export function DiceFace({ face, rolling }: DiceFaceProps) {
  const pips = face === null ? [] : (PIP_SPOTS[face] ?? []);
  return (
    <span className="die-scene block">
      <span aria-hidden="true" className="die-shadow" />
      <span className={`die-cube block ${rolling ? "animate-tumble" : ""}`}>
        {PLAIN_FACES.map((side) => (
          <span key={side} className={`die-face die-face--${side}`} />
        ))}
        <span className="die-face die-face--front grid grid-cols-3 grid-rows-3 place-items-center p-2.5">
          {NINE_SPOTS.map((spot) =>
            pips.includes(spot) ? (
              <span key={spot} data-pip="" className="die-pip h-3.5 w-3.5 rounded-full" />
            ) : (
              <span key={spot} />
            ),
          )}
        </span>
      </span>
    </span>
  );
}
