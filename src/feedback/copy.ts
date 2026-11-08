// Every error the player reads comes from here (NFR-SYS-08). Source: docs/03-ui-spec.md §7.

import type { ErrorCode } from "@/contract/errors";
import type { ServerError } from "@/contract/types";

const GENERIC_ERROR = "That didn't work. Try again."; // FR-SYS-04 ALT-04-1

// ILLEGAL_MOVE is left out on purpose: the server's own reason says exactly what was wrong.
const ERROR_COPY: Partial<Record<ErrorCode, string>> = {
  NOT_YOUR_TURN: "Wait for your turn.",
  ROLL_REQUIRED: "Roll the dice first.",
  ALREADY_ROLLED: "You already rolled. Pick a piece to move.",
  INVALID_NAME: "Use 1–20 letters or numbers for your name.",
  NAME_TAKEN: "Someone in this game already has that name. Try another.",
  INVALID_CODE: "That code doesn't look right. It has 6 letters and numbers.",
  ROOM_NOT_FOUND: "We couldn't find that game. Check the code.",
  ROOM_FULL: "That game is full.",
  GAME_ALREADY_STARTED: "That game has already started.",
  NOT_ENOUGH_PLAYERS: "You need at least 2 players. Add a computer player?",
  RATE_LIMITED: "Slow down a little and try again.",
  SERVER_BUSY: "The game server is busy. Try again in a minute.",
  UNAUTHORIZED: "Your game session ended. Please start again.",
  INTERNAL_ERROR: "Something went wrong. Your game is safe — try again.",
};

export const SESSION_REPLACED_MESSAGE = "This game is open in another tab.";

export function friendlyError(error: ServerError): string {
  return ERROR_COPY[error.code] ?? (error.message || GENERIC_ERROR);
}
