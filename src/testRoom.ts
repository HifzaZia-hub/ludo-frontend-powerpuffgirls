// Fixtures for tests only. It never runs in the app.

import { defaultRules } from "@/config/defaultRules";
import type { Player, RoomSnapshot } from "@/contract/types";

export function makePlayer(id: string, name: string, overrides: Partial<Player> = {}): Player {
  return {
    id,
    name,
    colour: "RED",
    isAi: false,
    connected: true,
    isHost: false,
    piecesHome: 0,
    ...overrides,
  };
}

/** A four-seat room with p1 (Rida) as host in seat 1 and the rest empty. */
export function makeRoom(overrides: Partial<RoomSnapshot> = {}): RoomSnapshot {
  return {
    v: "1.0.0",
    roomCode: "K7QX2M",
    status: "LOBBY",
    mode: "HUMAN_VS_HUMAN",
    rules: defaultRules,
    hostId: "p1",
    seats: [
      { seat: 1, colour: "RED", player: makePlayer("p1", "Rida", { isHost: true }) },
      { seat: 2, colour: "GREEN", player: null },
      { seat: 3, colour: "YELLOW", player: null },
      { seat: 4, colour: "BLUE", player: null },
    ],
    ...overrides,
  };
}
