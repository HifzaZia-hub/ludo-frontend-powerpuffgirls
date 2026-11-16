import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Group } from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { PIP_SPOTS } from "@/config/diceFaces";

// P14: the 3D die, loaded only when the "3D dice" setting is on. NFR-SYS-05: like the flat die, it
// is blank while it tumbles, then shows only the server's value, on the face turned to the player.
// Its other faces stay blank, so it never shows any number the server didn't send.

const SIZE = 1.4;
const CORNER = 0.22;
const PIP_RADIUS = 0.12;
const PIP_SPACING = 0.38;
// Tilted a little so it reads as a cube, with the value's face still the one you see most.
const REST: [number, number, number] = [-0.35, 0.45, 0];
// Radians a second while it tumbles. Fixed, never random (NFR-SYS-05).
const SPIN_X = 7;
const SPIN_Y = 9;

interface DieColours {
  face: string;
  pip: string;
}

// The same theme colours as the flat die. three can't read CSS variables, so this does.
function readColours(): DieColours {
  const style = getComputedStyle(document.documentElement);
  return {
    face: style.getPropertyValue("--board-cell").trim(),
    pip: style.getPropertyValue("--piece-edge").trim(),
  };
}

function useThemeColours(): DieColours {
  const [colours, setColours] = useState(readColours);
  useEffect(() => {
    // A theme change is only the data-theme attribute (FR-SYS-10 POST-10-3).
    const observer = new MutationObserver(() => setColours(readColours()));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, []);
  return colours;
}

interface CubeProps {
  face: number | null;
  rolling: boolean;
  colours: DieColours;
}

function Cube({ face, rolling, colours }: CubeProps) {
  const group = useRef<Group>(null);
  const invalidate = useThree((state) => state.invalidate);
  const geometry = useMemo(() => new RoundedBoxGeometry(SIZE, SIZE, SIZE, 4, CORNER), []);
  useEffect(() => () => geometry.dispose(), [geometry]);

  useEffect(() => {
    if (rolling || !group.current) return;
    group.current.rotation.set(...REST);
    invalidate(); // nothing redraws on its own once the die has stopped
  }, [rolling, invalidate]);

  useFrame((_, delta) => {
    if (!rolling || !group.current) return;
    group.current.rotation.x += delta * SPIN_X;
    group.current.rotation.y += delta * SPIN_Y;
  });

  const pips = rolling || face === null ? [] : (PIP_SPOTS[face] ?? []);
  return (
    <group ref={group} rotation={REST}>
      <mesh geometry={geometry}>
        <meshStandardMaterial color={colours.face} roughness={0.45} />
      </mesh>
      {pips.map((spot) => (
        <mesh
          key={spot}
          position={[
            ((spot % 3) - 1) * PIP_SPACING,
            (1 - Math.floor(spot / 3)) * PIP_SPACING,
            SIZE / 2 + 0.002,
          ]}
        >
          <circleGeometry args={[PIP_RADIUS, 24]} />
          <meshStandardMaterial color={colours.pip} />
        </mesh>
      ))}
    </group>
  );
}

export interface Die3DProps {
  /** The server's value, or null while rolling. */
  face: number | null;
  rolling: boolean;
}

export function Die3D({ face, rolling }: Die3DProps) {
  const colours = useThemeColours();
  return (
    // NFR-SYS-08: the button around it does the work, so the drawing is hidden and can't be clicked.
    <span aria-hidden="true" data-die3d="" className="pointer-events-none block h-20 w-20">
      <Canvas
        frameloop={rolling ? "always" : "demand"}
        dpr={[1, 2]}
        camera={{ position: [0, 0, 4.2], fov: 35 }}
        gl={{ antialias: true, alpha: true }}
      >
        <ambientLight intensity={0.8} />
        <directionalLight position={[2, 3, 4]} intensity={1.1} />
        <Cube face={face} rolling={rolling} colours={colours} />
      </Canvas>
    </span>
  );
}
