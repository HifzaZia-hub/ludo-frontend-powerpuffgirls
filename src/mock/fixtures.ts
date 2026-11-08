// Dev only: `?fixture=<name>` draws one of these snapshots with no server. main.tsx imports this
// behind a DEV check, so none of it reaches the production bundle.

import { defaultRules } from "@/config/defaultRules";
import { squareForStep } from "@/config/geometry";
import { PLAYER_IDENTITY } from "@/config/players";
import type { Colour, GameStateSnapshot, Piece, Player } from "@/contract/types";
import type { GameStore } from "@/store/gameStore";
import { useUiStore } from "@/store/uiStore";

const HOME_STEP = 57;

/** The player a fixture is viewed as. */
export const FIXTURE_PLAYER_ID = "p1";

type FourSteps = readonly [number, number, number, number];

const SEATS: Record<Colour, Omit<Player, "colour" | "piecesHome">> = {
  RED: { id: FIXTURE_PLAYER_ID, name: "Rida", isAi: false, connected: true, isHost: true },
  GREEN: { id: "p2", name: "Hamza", isAi: false, connected: true, isHost: false },
  YELLOW: { id: "p3", name: "Maryam", isAi: false, connected: true, isHost: false },
  BLUE: { id: "p4", name: "Computer 1", isAi: true, connected: true, isHost: false },
};

interface FixtureOptions {
  steps: Partial<Record<Colour, FourSteps>>;
  active: Colour;
  lastRoll?: number;
  offline?: Colour;
}

function makeFixture(name: string, options: FixtureOptions): GameStateSnapshot {
  const { steps, active, lastRoll = null, offline } = options;
  const seated = Object.entries(steps) as [Colour, FourSteps][];

  const players = seated.map(
    ([colour, four]): Player => ({
      ...SEATS[colour],
      colour,
      connected: colour !== offline && SEATS[colour].connected,
      piecesHome: four.filter((step) => step === HOME_STEP).length,
    }),
  );
  const pieces = seated.flatMap(([colour, four]) =>
    four.map(
      (step, index): Piece => ({
        id: `${PLAYER_IDENTITY[colour].letter}${index + 1}`,
        colour,
        step,
        boardSquare: squareForStep(colour, step),
      }),
    ),
  );

  return {
    v: "1.0.0",
    roomCode: "FIXTUR",
    matchId: `fixture-${name}`,
    version: 1,
    status: "IN_PROGRESS",
    rules: defaultRules,
    players,
    pieces,
    turn: {
      activePlayerId: SEATS[active].id,
      phase: "AWAITING_ROLL",
      lastRoll,
      sixesInRow: 0,
      legalMoves: [],
      deadline: null,
    },
    seedHash: "fixture",
  };
}

export const FIXTURES: Record<string, GameStateSnapshot> = {
  start: makeFixture("start", {
    steps: {
      RED: [0, 0, 0, 0],
      GREEN: [0, 0, 0, 0],
      YELLOW: [0, 0, 0, 0],
      BLUE: [0, 0, 0, 0],
    },
    active: "RED",
  }),
  spread: makeFixture("spread", {
    steps: {
      RED: [0, 7, 30, 54],
      GREEN: [0, 0, 14, 57],
      YELLOW: [20, 45, 53, 57],
      BLUE: [0, 3, 57, 57],
    },
    active: "GREEN",
    lastRoll: 4,
    offline: "YELLOW",
  }),
  // Square 4 holds two of Red's. Square 18 holds three of Green's. Safe squares 21 and 34 hold
  // three and four pieces of different colours.
  stacked: makeFixture("stacked", {
    steps: {
      RED: [5, 5, 22, 35],
      GREEN: [6, 6, 6, 22],
      YELLOW: [48, 9, 0, 0],
      BLUE: [35, 48, 0, 0],
    },
    active: "YELLOW",
    lastRoll: 6,
  }),
  homeRun: makeFixture("homeRun", {
    steps: {
      RED: [52, 53, 57, 57],
      GREEN: [54, 55, 56, 57],
      YELLOW: [56, 56, 57, 0],
      BLUE: [57, 57, 57, 52],
    },
    active: "BLUE",
    lastRoll: 2,
  }),
  // Step 1 and step 51 for every colour: step 51 must sit right next to that colour's home column.
  edges: makeFixture("edges", {
    steps: {
      RED: [1, 51, 0, 0],
      GREEN: [1, 51, 0, 0],
      YELLOW: [1, 51, 0, 0],
      BLUE: [1, 51, 0, 0],
    },
    active: "RED",
  }),
  // R1: a two-player game uses opposite corners.
  twoPlayer: makeFixture("twoPlayer", {
    steps: {
      RED: [0, 12, 57, 0],
      YELLOW: [0, 0, 33, 0],
    },
    active: "YELLOW",
    lastRoll: 5,
  }),
};

export function showFixture(name: string, store: GameStore): void {
  const snapshot = FIXTURES[name];
  if (!snapshot) {
    console.error(`No fixture "${name}". Try: ${Object.keys(FIXTURES).join(", ")}.`);
    return;
  }
  store.setState({ myPlayerId: FIXTURE_PLAYER_ID });
  store.getState().applySnapshot(snapshot);
  useUiStore.getState().goTo("game");
}
