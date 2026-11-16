import { NINE_SPOTS, PIP_SPOTS } from "@/config/diceFaces";

export interface DiceFaceProps {
  /** The server's value, or null while rolling. */
  face: number | null;
  rolling: boolean;
}

// The flat die face. NFR-SYS-05: blank while it tumbles, then exactly the server's value.
export function DiceFace({ face, rolling }: DiceFaceProps) {
  const pips = face === null ? [] : (PIP_SPOTS[face] ?? []);
  return (
    <span
      className={`grid h-20 w-20 grid-cols-3 grid-rows-3 place-items-center rounded-2xl border-2 border-piece-edge bg-board-cell p-2 ${
        rolling ? "animate-tumble" : ""
      }`}
    >
      {NINE_SPOTS.map((spot) =>
        pips.includes(spot) ? (
          <span key={spot} data-pip="" className="h-3 w-3 rounded-full bg-piece-edge" />
        ) : (
          <span key={spot} />
        ),
      )}
    </span>
  );
}
