// Mirrors the backend LGS contract. The backend's package wins any disagreement.
// Source: docs/01-contract.md §1 and §5. Types only.

import type { ErrorCode } from "@/contract/errors";

export type Colour = "RED" | "GREEN" | "YELLOW" | "BLUE";
export type RoomStatus = "LOBBY" | "IN_PROGRESS" | "FINISHED" | "CLOSED";
export type TurnPhase = "AWAITING_ROLL" | "AWAITING_MOVE";
export type Difficulty = "EASY" | "NORMAL";
export type GameMode = "HUMAN_VS_HUMAN" | "HUMAN_VS_AI";

export interface RuleConfig {
  turnTimerSeconds: number; // default 30. 0 = no limit for connected humans, else 10-120
  threeSixesForfeit: boolean; // default true
  bonusOnSix: boolean; // default true
  bonusOnCapture: boolean; // default true
  bonusOnFinish: boolean; // default true
  safeSquares: number[]; // default [0, 8, 13, 21, 26, 34, 39, 47]
  autoMoveSingleOption: boolean; // default false
  aiDelayMs: number; // default 700, range 0-2000
  standInDelayMs: number; // default 3000, range 0-10000
}

export interface Player {
  id: string;
  name: string;
  colour: Colour;
  isAi: boolean;
  connected: boolean;
  isHost: boolean;
  piecesHome: number; // 0-4
}

export interface Piece {
  id: string; // "R1".."R4", "G1".., "Y1".., "B1".."B4"
  colour: Colour;
  step: number; // 0 = yard, 1-51 = main track, 52-56 = home column, 57 = home
  boardSquare: number | null; // 0-51 when on the main track, else null
}

export interface LegalMove {
  pieceId: string;
  fromStep: number;
  toStep: number;
  captures: string[]; // piece IDs this move would capture
}

export interface TurnState {
  activePlayerId: string;
  phase: TurnPhase;
  lastRoll: number | null; // 1-6
  sixesInRow: number; // 0-2 (a third six ends the turn)
  legalMoves: LegalMove[]; // non-empty only in AWAITING_MOVE
  deadline: string | null; // ISO timestamp; null when turnTimerSeconds is 0
}

export interface GameStateSnapshot {
  v: string;
  roomCode: string;
  matchId: string;
  version: number;
  status: RoomStatus;
  rules: RuleConfig;
  players: Player[];
  pieces: Piece[];
  turn: TurnState;
  seedHash: string;
  winnerId?: string; // only once the match is over
  ranking?: string[]; // player IDs, best first
  seed?: string; // revealed only when the match is over
}

export interface RoomSnapshot {
  v: string;
  roomCode: string;
  status: RoomStatus;
  mode: GameMode;
  rules: RuleConfig;
  hostId: string;
  seats: Array<{
    seat: number;
    colour: Colour;
    player: Player | null; // null = empty seat
  }>;
}

export interface ServerError {
  code: ErrorCode;
  message: string; // plain English, <= 120 chars, safe to show the player
  requestId?: string;
  details?: unknown;
}

// POST /api/v1/rooms
export interface CreateRoomRequest {
  displayName: string; // 1-20 chars: letters, digits, space, _ - .
  mode: GameMode;
  seats: 2 | 3 | 4;
  aiDifficulty?: Difficulty; // default NORMAL
  rules?: Partial<RuleConfig>;
}

export interface CreateRoomResponse {
  v: string;
  roomCode: string;
  playerId: string;
  sessionToken: string;
  room: RoomSnapshot;
}

// POST /api/v1/rooms/{roomCode}/join
export interface JoinRoomRequest {
  displayName: string;
}

export interface JoinRoomResponse {
  v: string;
  playerId: string;
  sessionToken: string;
  room: RoomSnapshot;
}

// GET /api/v1/health. The contract names these fields but not their value types, so the
// types below are an assumption until the question in docs/01-contract.md §8 is answered.
export interface HealthResponse {
  status: string;
  uptimeS: number;
  rooms: number;
  clients: number;
  version: string;
}

// GET /api/v1/rooms/{roomCode} (RoomPreview) is left out on purpose: the contract describes
// its contents but gives no field names, and we never guess one (docs/01-contract.md §8).
