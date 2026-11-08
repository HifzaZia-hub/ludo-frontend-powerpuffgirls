// Mirrors the backend LGS contract (docs/01-contract.md §4).
// The backend's package wins any disagreement.

export type EventType =
  | "GAME_STARTED"
  | "ROLLED"
  | "MOVED"
  | "CAPTURED"
  | "PIECE_FINISHED"
  | "BONUS_TURN"
  | "TURN_CHANGED"
  | "TURN_PASSED"
  | "TURN_FORFEITED"
  | "PLAYER_DISCONNECTED"
  | "PLAYER_RECONNECTED"
  | "PLAYER_LEFT"
  | "PLAYER_IDLE"
  | "GAME_OVER"
  | "GAME_ABANDONED"
  | "GAME_RESTARTED";

export interface ServerEvent {
  v: string;
  version: number;
  type: EventType;
  data: unknown;
}
