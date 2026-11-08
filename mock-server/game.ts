// The Ludo rules for the mock LGS. This folder is the server, so it is the one place in the
// repository where game logic is allowed (CLAUDE.md §1). ESLint stops `src/` importing it.
//
// Only types come from `src/contract`, so the mock stops compiling if the contract changes.
// Board positions are worked out here on purpose instead of borrowing `src/config/geometry`:
// sharing that code would hide a client geometry bug, because both sides would be wrong together.

import { createHash, createHmac, randomBytes, randomUUID } from "node:crypto";
import type { ErrorCode } from "../src/contract/errors";
import type { EventType } from "../src/contract/events";
import type {
  Colour,
  GameStateSnapshot,
  LegalMove,
  Piece,
  Player,
  RoomStatus,
  RuleConfig,
  ServerError,
  TurnState,
} from "../src/contract/types";

export const CONTRACT_VERSION = "1.0.0";
export const YARD_STEP = 0;
export const HOME_STEP = 57;
export const COLOUR_ORDER: readonly Colour[] = ["RED", "GREEN", "YELLOW", "BLUE"];
// Our D3 rule R1: a 2-player game uses opposite corners, so seat 2 is Yellow rather than Green.
export const SEAT_COLOURS: Record<2 | 3 | 4, readonly Colour[]> = {
  2: ["RED", "YELLOW"],
  3: ["RED", "GREEN", "YELLOW"],
  4: COLOUR_ORDER,
};

const LAST_TRACK_STEP = 51;
const TRACK_SQUARES = 52;
const SIX = 6;
const PIECES_EACH = 4;
const START_SQUARE: Record<Colour, number> = { RED: 0, GREEN: 13, YELLOW: 26, BLUE: 39 };

export const DEFAULT_RULES: RuleConfig = {
  turnTimerSeconds: 30,
  threeSixesForfeit: true,
  bonusOnSix: true,
  bonusOnCapture: true,
  bonusOnFinish: true,
  safeSquares: [0, 8, 13, 21, 26, 34, 39, 47],
  autoMoveSingleOption: false,
  aiDelayMs: 700,
  standInDelayMs: 3000,
};

/** A request the server refuses. `message` is shown to the player, so keep it plain. */
export class CommandError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export function toServerError(error: unknown, requestId?: string): ServerError {
  if (error instanceof CommandError) {
    return { code: error.code, message: error.message, requestId };
  }
  // A bug in the mock itself: keep the detail in the server log and away from the player.
  console.error("[mock] unexpected error", error);
  return {
    code: "INTERNAL_ERROR",
    message: "Something went wrong on the server. Please try again.",
    requestId,
  };
}

export interface Match {
  roomCode: string;
  matchId: string;
  version: number;
  status: RoomStatus;
  rules: RuleConfig;
  players: Player[]; // seat order, which is also clockwise turn order
  pieces: Piece[];
  turn: TurnState;
  seed: string; // never leaves the server while the match is running
  seedHash: string;
  draws: number; // how many random numbers this seed has produced
  winnerId?: string;
  ranking?: string[];
}

export interface NewMatch {
  roomCode: string;
  rules: RuleConfig;
  players: Player[];
  seed?: string;
}

export function boardSquareFor(colour: Colour, step: number): number | null {
  if (step < 1 || step > LAST_TRACK_STEP) return null;
  return (START_SQUARE[colour] + step - 1) % TRACK_SQUARES;
}

export function placePiece(piece: Piece, step: number): void {
  piece.step = step;
  piece.boardSquare = boardSquareFor(piece.colour, step);
}

export function newDeadline(rules: RuleConfig): string | null {
  if (rules.turnTimerSeconds === 0) return null;
  return new Date(Date.now() + rules.turnTimerSeconds * 1000).toISOString();
}

function newPieces(player: Player): Piece[] {
  return Array.from({ length: PIECES_EACH }, (_, index) => ({
    id: `${player.colour.charAt(0)}${index + 1}`,
    colour: player.colour,
    step: YARD_STEP,
    boardSquare: null,
  }));
}

export function createMatch(input: NewMatch): Match {
  const first = input.players[0];
  if (!first) throw new Error("A match needs at least one player");

  for (const player of input.players) player.piecesHome = 0;

  const seed = input.seed ?? randomBytes(32).toString("hex");
  return {
    roomCode: input.roomCode,
    matchId: randomUUID(),
    version: 0,
    status: "IN_PROGRESS",
    rules: input.rules,
    players: input.players,
    pieces: input.players.flatMap(newPieces),
    turn: {
      activePlayerId: first.id, // seat 1 starts until the backend answers contract §8 (FR-08)
      phase: "AWAITING_ROLL",
      lastRoll: null,
      sixesInRow: 0,
      legalMoves: [],
      deadline: newDeadline(input.rules),
    },
    seed,
    seedHash: createHash("sha256").update(seed).digest("hex"),
    draws: 0,
  };
}

/** A random whole number from 0 to sides - 1. The seed alone reproduces every draw of a match. */
export function drawInt(match: Match, sides: number): number {
  // Rejection sampling: taking a plain byte % sides would make the low numbers slightly likelier.
  const limit = 256 - (256 % sides);
  for (;;) {
    const digest = createHmac("sha256", match.seed).update(String(match.draws)).digest();
    match.draws += 1;
    for (const byte of digest) {
      if (byte < limit) return byte % sides;
    }
  }
}

export function drawDie(match: Match): number {
  return drawInt(match, SIX) + 1;
}

export function activePlayer(match: Match): Player {
  const player = match.players.find(({ id }) => id === match.turn.activePlayerId);
  if (!player) throw new Error("The active player is not in this match");
  return player;
}

export function piecesOf(match: Match, colour: Colour): Piece[] {
  return match.pieces.filter((piece) => piece.colour === colour);
}

function destinationStep(step: number, roll: number): number | null {
  if (step === HOME_STEP) return null;
  if (step === YARD_STEP) return roll === SIX ? 1 : null; // G-4: leave the yard only on a 6
  const destination = step + roll;
  return destination <= HOME_STEP ? destination : null; // G-6: exact roll to finish
}

function capturesAt(match: Match, colour: Colour, toStep: number): string[] {
  const square = boardSquareFor(colour, toStep);
  if (square === null || match.rules.safeSquares.includes(square)) return []; // G-7
  return match.pieces
    .filter((piece) => piece.colour !== colour && piece.boardSquare === square)
    .map((piece) => piece.id);
}

export function computeLegalMoves(match: Match, roll: number): LegalMove[] {
  const { colour } = activePlayer(match);
  return piecesOf(match, colour).flatMap((piece) => {
    const toStep = destinationStep(piece.step, roll);
    if (toStep === null) return [];
    return [
      {
        pieceId: piece.id,
        fromStep: piece.step,
        toStep,
        captures: capturesAt(match, colour, toStep),
      },
    ];
  });
}

function awaitRoll(match: Match, playerId: string, sixesInRow: number): void {
  match.turn = {
    ...match.turn,
    activePlayerId: playerId,
    phase: "AWAITING_ROLL",
    sixesInRow,
    legalMoves: [],
    deadline: newDeadline(match.rules),
  };
}

function advanceTurn(match: Match): void {
  const index = match.players.findIndex(({ id }) => id === match.turn.activePlayerId);
  const next = match.players[(index + 1) % match.players.length];
  if (!next) throw new Error("A match needs at least one player");
  awaitRoll(match, next.id, 0);
}

function rankPlayers(match: Match): string[] {
  const progress = (player: Player): number =>
    piecesOf(match, player.colour).reduce((total, piece) => total + piece.step, 0);
  // sort() is stable, so players level on progress stay in seat order.
  return [...match.players].sort((a, b) => progress(b) - progress(a)).map(({ id }) => id);
}

/** Applies a die value the caller has already drawn, and returns the events it caused. */
export function applyRoll(match: Match, value: number): EventType[] {
  const sixes = value === SIX ? match.turn.sixesInRow + 1 : 0;
  match.turn.lastRoll = value;

  if (sixes === 3 && match.rules.threeSixesForfeit) {
    advanceTurn(match); // G-9
    return ["ROLLED", "TURN_FORFEITED", "TURN_CHANGED"];
  }

  // With the forfeit rule off a run can pass three, but the contract caps this field at 2.
  match.turn.sixesInRow = Math.min(sixes, 2);
  match.turn.legalMoves = computeLegalMoves(match, value);
  // Stay in AWAITING_MOVE even with no moves: the client shows the roll for a moment, and a
  // second game:roll during that pause must still answer ALREADY_ROLLED (G-10).
  match.turn.phase = "AWAITING_MOVE";
  match.turn.deadline = newDeadline(match.rules);
  return ["ROLLED"];
}

export function passTurn(match: Match): EventType[] {
  advanceTurn(match); // G-10
  return ["TURN_PASSED", "TURN_CHANGED"];
}

export function applyMove(match: Match, move: LegalMove): EventType[] {
  const player = activePlayer(match);
  const piece = match.pieces.find(({ id }) => id === move.pieceId);
  if (!piece) throw new Error(`Unknown piece ${move.pieceId}`);

  const events: EventType[] = ["MOVED"];
  placePiece(piece, move.toStep);

  for (const capturedId of move.captures) {
    const captured = match.pieces.find(({ id }) => id === capturedId);
    if (captured) placePiece(captured, YARD_STEP);
    events.push("CAPTURED");
  }

  const finished = move.toStep === HOME_STEP;
  if (finished) {
    player.piecesHome += 1;
    events.push("PIECE_FINISHED");
  }

  if (player.piecesHome === PIECES_EACH) {
    match.status = "FINISHED"; // G-11
    match.winnerId = player.id;
    match.ranking = rankPlayers(match);
    match.turn = { ...match.turn, legalMoves: [], deadline: null };
    events.push("GAME_OVER");
    return events;
  }

  const { rules, turn } = match;
  const earnedBonus =
    (turn.lastRoll === SIX && rules.bonusOnSix) ||
    (move.captures.length > 0 && rules.bonusOnCapture) ||
    (finished && rules.bonusOnFinish);

  if (earnedBonus) {
    awaitRoll(match, player.id, turn.sixesInRow); // G-8
    events.push("BONUS_TURN");
  } else {
    advanceTurn(match);
    events.push("TURN_CHANGED");
  }
  return events;
}

/** Throws unless a match is running and it is this player's turn. */
export function requireTurn(match: Match | null, playerId: string): Match {
  if (!match) throw new CommandError("GAME_NOT_STARTED", "The game hasn't started yet.");
  if (match.status !== "IN_PROGRESS") {
    throw new CommandError("GAME_NOT_IN_PROGRESS", "This game is not being played right now.");
  }
  if (match.turn.activePlayerId !== playerId) {
    throw new CommandError("NOT_YOUR_TURN", "It isn't your turn yet.");
  }
  return match;
}

function illegalMoveReason(match: Match, piece: Piece): string {
  const { colour } = activePlayer(match);
  if (piece.colour !== colour) return "That piece belongs to another player.";
  if (piece.step === HOME_STEP) return "That piece is already home.";
  if (piece.step === YARD_STEP) return "A piece needs a 6 to leave the yard.";
  return "That piece needs an exact roll to reach home.";
}

/** Throws the reason this move is refused, or returns the legal move it matches. */
export function requireLegalMove(
  matchOrNull: Match | null,
  playerId: string,
  pieceId: string,
): { match: Match; move: LegalMove } {
  const match = requireTurn(matchOrNull, playerId);
  if (match.turn.phase === "AWAITING_ROLL") {
    throw new CommandError("ROLL_REQUIRED", "Roll the die first.");
  }
  const piece = match.pieces.find(({ id }) => id === pieceId);
  if (!piece) throw new CommandError("PIECE_NOT_FOUND", "We couldn't find that piece.");

  const move = match.turn.legalMoves.find((candidate) => candidate.pieceId === pieceId);
  if (!move) throw new CommandError("ILLEGAL_MOVE", illegalMoveReason(match, piece));
  return { match, move };
}

export function toSnapshot(match: Match): GameStateSnapshot {
  const isOver = match.winnerId !== undefined;
  // Cloned so a later change to the match can't reach something already handed out.
  return structuredClone({
    v: CONTRACT_VERSION,
    roomCode: match.roomCode,
    matchId: match.matchId,
    version: match.version,
    status: match.status,
    rules: match.rules,
    players: match.players,
    pieces: match.pieces,
    turn: match.turn,
    seedHash: match.seedHash,
    // Contract §5: the seed is revealed only once the match is over.
    ...(isOver ? { winnerId: match.winnerId, ranking: match.ranking, seed: match.seed } : {}),
  });
}
