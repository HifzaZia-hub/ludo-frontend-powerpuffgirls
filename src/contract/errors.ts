// Mirrors the backend LGS contract (docs/01-contract.md §6).
// The backend's package wins any disagreement.

export type ErrorCode =
  | "INVALID_PAYLOAD"
  | "INVALID_NAME"
  | "INVALID_CODE"
  | "INVALID_RULES"
  | "UNAUTHORIZED"
  | "NOT_HOST"
  | "ROOM_NOT_FOUND"
  | "PIECE_NOT_FOUND"
  | "NAME_TAKEN"
  | "ROOM_FULL"
  | "GAME_ALREADY_STARTED"
  | "GAME_NOT_STARTED"
  | "GAME_NOT_IN_PROGRESS"
  | "NOT_ENOUGH_PLAYERS"
  | "NOT_YOUR_TURN"
  | "ROLL_REQUIRED"
  | "ALREADY_ROLLED"
  | "ILLEGAL_MOVE"
  | "RATE_LIMITED"
  | "SERVER_BUSY"
  | "INTERNAL_ERROR";

/** The form field an inline error message is shown under. */
export type FormField = "name" | "roomCode";

// These codes mean our client state is stale, not that the player did anything wrong,
// so they trigger state:sync instead of a telling-off.
export const RESYNC_CODES: readonly ErrorCode[] = [
  "PIECE_NOT_FOUND",
  "NOT_YOUR_TURN",
  "GAME_NOT_IN_PROGRESS",
];

export const FIELD_ERRORS: Partial<Record<ErrorCode, FormField>> = {
  INVALID_NAME: "name",
  NAME_TAKEN: "name",
  INVALID_CODE: "roomCode",
  ROOM_NOT_FOUND: "roomCode",
  ROOM_FULL: "roomCode",
  GAME_ALREADY_STARTED: "roomCode",
};
