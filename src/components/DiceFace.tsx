import { DieCube } from "@/components/DieCube";

export interface DiceFaceProps {
  /** The server's value, or null while rolling. */
  face: number | null;
  rolling: boolean;
}

// The game's die: a 3D cube with a glowing ring round it.
// NFR-SYS-05: blank while it tumbles, then it settles with exactly the server's value facing the
// player. Only that face's pips carry data-pip, so the value shown can be counted.
export function DiceFace({ face, rolling }: DiceFaceProps) {
  let motion = "";
  if (rolling) motion = "animate-tumble";
  else if (face !== null) motion = "die-land";

  return (
    <span className="die-scene block">
      <span aria-hidden="true" className="die-shadow" />
      <span className="die-tilt">
        <span aria-hidden="true" className="die-orbit" />
        {/* A new key for each value, so the settling turn plays again after every roll. */}
        <DieCube
          key={rolling ? "rolling" : `face-${face ?? "none"}`}
          value={rolling ? null : face}
          markValue
          className={motion}
        />
      </span>
    </span>
  );
}
