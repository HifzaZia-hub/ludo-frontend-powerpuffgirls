// Test helpers that are not part of the LGS contract. server.ts only mounts these routes when the
// mock is started in debug mode, so a normal run can't have its dice or board tampered with.

import { Router } from "express";
import type { Colour, Player } from "../src/contract/types";
import {
  boardSquareFor,
  CommandError,
  CONTRACT_VERSION,
  HOME_STEP,
  newDeadline,
  piecesOf,
  placePiece,
  YARD_STEP,
  type Match,
} from "./game";
import { asRecord, parseRules, type RoomRegistry } from "./rooms";
import { jsonRoute } from "./rest";

const NEAR_WIN_STEP = 54;
const LAST_TRACK_STEP = 51;

function focusPlayer(match: Match): Player {
  const player = match.players.find(({ isAi }) => !isAi) ?? match.players[0];
  if (!player) throw new Error("A match needs at least one player");
  return player;
}

/** Empties the board and hands the next roll to `player`. */
function clearBoard(match: Match, player: Player): void {
  for (const piece of match.pieces) placePiece(piece, YARD_STEP);
  for (const seated of match.players) seated.piecesHome = 0;
  match.turn = {
    activePlayerId: player.id,
    phase: "AWAITING_ROLL",
    lastRoll: null,
    sixesInRow: 0,
    legalMoves: [],
    deadline: newDeadline(match.rules),
  };
}

function stepOnSquare(colour: Colour, square: number): number | null {
  for (let step = 1; step <= LAST_TRACK_STEP; step += 1) {
    if (boardSquareFor(colour, step) === square) return step;
  }
  return null; // the one square behind a colour's start, which that colour never lands on
}

// Each scenario returns the rolls that make its point, because a random die would usually miss.
type Scenario = (match: Match, player: Player) => number[];

const SCENARIOS = new Map<string, Scenario>([
  [
    "near-win",
    (match, player) => {
      piecesOf(match, player.colour).forEach((piece, index) => {
        placePiece(piece, index < 3 ? HOME_STEP : NEAR_WIN_STEP);
      });
      player.piecesHome = 3;
      return [HOME_STEP - NEAR_WIN_STEP];
    },
  ],
  [
    "capture-ready",
    (match, player) => {
      const opponent = match.players.find(({ id }) => id !== player.id);
      const attacker = piecesOf(match, player.colour)[0];
      const target = opponent && piecesOf(match, opponent.colour)[0];
      if (!opponent || !attacker || !target) throw new Error("capture-ready needs two players");

      const safe = match.rules.safeSquares;
      for (let step = 1; step < LAST_TRACK_STEP; step += 1) {
        const from = boardSquareFor(player.colour, step);
        const onto = boardSquareFor(player.colour, step + 1);
        if (from === null || onto === null || safe.includes(from) || safe.includes(onto)) continue;
        const opponentStep = stepOnSquare(opponent.colour, onto);
        if (opponentStep === null) continue;
        placePiece(attacker, step);
        placePiece(target, opponentStep);
        return [1];
      }
      throw new CommandError("INVALID_RULES", "These safe squares leave no room for a capture.");
    },
  ],
  [
    "three-sixes",
    (match, player) => {
      const first = piecesOf(match, player.colour)[0];
      if (first) placePiece(first, 5); // on the track, so only the forfeit can stop a move
      match.turn.sixesInRow = 2;
      match.turn.lastRoll = 6;
      return [6];
    },
  ],
  ["no-legal-move", () => [3]], // every piece is in the yard and 3 can't bring one out
]);

export function debugRouter(registry: RoomRegistry): Router {
  const router = Router();

  router.post(
    "/force-roll",
    jsonRoute(200, (req) => {
      const body = asRecord(req.body);
      const value = body.value;
      // null goes back to the seeded die.
      if (
        value !== null &&
        !(Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 6)
      ) {
        throw new CommandError("INVALID_PAYLOAD", "value must be 1 to 6, or null to stop forcing.");
      }
      const room = registry.debugRoom(body.roomCode);
      const forcedRoll = value === null ? null : Number(value);
      registry.setForcedRoll(room, forcedRoll);
      return { v: CONTRACT_VERSION, roomCode: room.code, forcedRoll };
    }),
  );

  router.post(
    "/scenario",
    jsonRoute(200, (req) => {
      const body = asRecord(req.body);
      const scenario = typeof body.name === "string" ? SCENARIOS.get(body.name) : undefined;
      if (!scenario) {
        const names = [...SCENARIOS.keys()].join(", ");
        throw new CommandError("INVALID_PAYLOAD", `name must be one of: ${names}.`);
      }
      const room = registry.debugRoom(body.roomCode);
      const version = registry.jumpToScenario(room, (match) => {
        const player = focusPlayer(match);
        clearBoard(match, player);
        return scenario(match, player);
      });
      return { v: CONTRACT_VERSION, roomCode: room.code, scenario: body.name, version };
    }),
  );

  router.post(
    "/rules",
    jsonRoute(200, (req) => {
      const { roomCode, ...partialRules } = asRecord(req.body);
      const room = registry.debugRoom(roomCode);
      registry.setNextRules(room, parseRules(partialRules));
      return { v: CONTRACT_VERSION, roomCode: room.code, rules: room.rules };
    }),
  );

  return router;
}
