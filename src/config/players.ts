// NFR-SYS-07: every colour also has a letter and a shape, so colour is never the only signal.
// This is the only place that maps a colour to anything (docs/03-ui-spec.md §3).

import type { Colour } from "@/contract/types";

export type PlayerShape = "circle" | "triangle" | "square" | "diamond";

export interface PlayerIdentity {
  letter: string;
  shape: PlayerShape;
  token: string; // CSS colour, so light and dark themes both work
}

// Contract §1: whoever creates a room always takes seat 1, which is Red.
export const HOST_COLOUR: Colour = "RED";

export const PLAYER_IDENTITY: Record<Colour, PlayerIdentity> = {
  RED: { letter: "R", shape: "circle", token: "var(--p-red)" },
  GREEN: { letter: "G", shape: "triangle", token: "var(--p-green)" },
  YELLOW: { letter: "Y", shape: "square", token: "var(--p-yellow)" },
  BLUE: { letter: "B", shape: "diamond", token: "var(--p-blue)" },
};
