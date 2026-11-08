// The four REST routes from docs/01-contract.md §1.

import { Router, type Request, type RequestHandler, type Response } from "express";
import type { ErrorCode } from "../src/contract/errors";
import { CONTRACT_VERSION, toServerError } from "./game";
import type { RoomRegistry } from "./rooms";

const HTTP_STATUS: Record<ErrorCode, number> = {
  INVALID_PAYLOAD: 400,
  INVALID_NAME: 400,
  INVALID_CODE: 400,
  INVALID_RULES: 400,
  UNAUTHORIZED: 401,
  NOT_HOST: 403,
  ROOM_NOT_FOUND: 404,
  PIECE_NOT_FOUND: 404,
  NAME_TAKEN: 409,
  ROOM_FULL: 409,
  GAME_ALREADY_STARTED: 409,
  GAME_NOT_STARTED: 409,
  GAME_NOT_IN_PROGRESS: 409,
  NOT_ENOUGH_PLAYERS: 409,
  NOT_YOUR_TURN: 409,
  ROLL_REQUIRED: 409,
  ALREADY_ROLLED: 409,
  ILLEGAL_MOVE: 422,
  RATE_LIMITED: 429,
  SERVER_BUSY: 503,
  INTERNAL_ERROR: 500,
};

export function sendError(res: Response, error: unknown): void {
  const serverError = toServerError(error);
  // The contract gives REST errors a status but no body, so this is a bare ServerError.
  res.status(HTTP_STATUS[serverError.code]).json({ v: CONTRACT_VERSION, ...serverError });
}

export function jsonRoute(status: number, handler: (req: Request) => unknown): RequestHandler {
  return (req, res) => {
    try {
      res.status(status).json(handler(req));
    } catch (error) {
      sendError(res, error);
    }
  };
}

export function restRouter(registry: RoomRegistry, clientCount: () => number): Router {
  const router = Router();
  const startedAt = Date.now();

  router.post(
    "/rooms",
    jsonRoute(201, (req) => registry.createRoom(req.body)),
  );
  router.post(
    "/rooms/:code/join",
    jsonRoute(200, (req) => registry.joinRoom(String(req.params.code), req.body)),
  );
  router.get(
    "/rooms/:code",
    // The preview's field names are still an open question (contract §8), so this sends a
    // RoomSnapshot: status, mode, host and free seats are all in it under agreed names.
    jsonRoute(200, (req) => registry.previewRoom(String(req.params.code))),
  );
  router.get(
    "/health",
    jsonRoute(200, () => ({
      v: CONTRACT_VERSION,
      status: "ok",
      uptimeS: Math.floor((Date.now() - startedAt) / 1000),
      rooms: registry.roomCount(),
      clients: clientCount(),
      version: CONTRACT_VERSION,
    })),
  );
  return router;
}
