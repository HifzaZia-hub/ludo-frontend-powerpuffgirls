// @vitest-environment node

import { defaultRules } from "../src/config/defaultRules";
import { squareForStep } from "../src/config/geometry";
import type { Difficulty, LegalMove, Piece, Player, RuleConfig } from "../src/contract/types";
import { chooseMove, scoreMove } from "./ai";
import {
  applyMove,
  applyRoll,
  boardSquareFor,
  COLOUR_ORDER,
  CommandError,
  createMatch,
  DEFAULT_RULES,
  drawDie,
  passTurn,
  placePiece,
  requireLegalMove,
  SEAT_COLOURS,
  toSnapshot,
  type Match,
} from "./game";

function makePlayers(count: 2 | 3 | 4): Player[] {
  return SEAT_COLOURS[count].map((colour, index) => ({
    id: `p${index + 1}`,
    name: `Player ${index + 1}`,
    colour,
    isAi: false,
    connected: true,
    isHost: index === 0,
    piecesHome: 0,
  }));
}

function makeMatch(
  count: 2 | 3 | 4 = 4,
  rules: Partial<RuleConfig> = {},
  seed = "test-seed",
): Match {
  return createMatch({
    roomCode: "ABC234",
    rules: { ...structuredClone(DEFAULT_RULES), ...rules },
    players: makePlayers(count),
    seed,
  });
}

function pieceById(match: Match, id: string): Piece {
  const piece = match.pieces.find((candidate) => candidate.id === id);
  if (!piece) throw new Error(`No piece ${id}`);
  return piece;
}

function put(match: Match, placements: Record<string, number>): void {
  for (const [id, step] of Object.entries(placements)) placePiece(pieceById(match, id), step);
}

function moveFor(match: Match, id: string): LegalMove {
  const move = match.turn.legalMoves.find((candidate) => candidate.pieceId === id);
  if (!move) throw new Error(`${id} has no legal move`);
  return move;
}

function legalIds(match: Match): string[] {
  return match.turn.legalMoves.map(({ pieceId }) => pieceId);
}

function codeOf(action: () => unknown): string {
  try {
    action();
  } catch (error) {
    if (error instanceof CommandError) return error.code;
    throw error;
  }
  return "no error";
}

describe("agreement with the client", () => {
  it("has the same default rules as the client's config", () => {
    expect(DEFAULT_RULES).toEqual(defaultRules);
  });

  it("puts every step on the same square as the client's geometry", () => {
    for (const colour of COLOUR_ORDER) {
      for (let step = 0; step <= 57; step += 1) {
        expect(boardSquareFor(colour, step)).toBe(squareForStep(colour, step));
      }
    }
  });
});

describe("the die", () => {
  it("only produces 1 to 6 and reaches every face", () => {
    const match = makeMatch();
    const faces = new Set(Array.from({ length: 500 }, () => drawDie(match)));
    expect([...faces].sort()).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("repeats exactly for the same seed", () => {
    const first = makeMatch(2, {}, "same");
    const second = makeMatch(2, {}, "same");
    const rolls = (match: Match) => Array.from({ length: 50 }, () => drawDie(match));
    expect(rolls(first)).toEqual(rolls(second));
  });
});

describe("moving (G-4, G-6)", () => {
  it("only leaves the yard on a 6", () => {
    const match = makeMatch();
    applyRoll(match, 5);
    expect(match.turn.legalMoves).toEqual([]);

    const onSix = makeMatch();
    applyRoll(onSix, 6);
    expect(legalIds(onSix)).toEqual(["R1", "R2", "R3", "R4"]);
    expect(moveFor(onSix, "R1")).toMatchObject({ fromStep: 0, toStep: 1 });
  });

  it("needs an exact roll to reach home", () => {
    const tooFar = makeMatch();
    put(tooFar, { R1: 55 });
    applyRoll(tooFar, 3);
    expect(legalIds(tooFar)).toEqual([]);

    const exact = makeMatch();
    put(exact, { R1: 55 });
    applyRoll(exact, 2);
    expect(moveFor(exact, "R1").toStep).toBe(57);
  });

  it("clears boardSquare in the home column and when home", () => {
    const match = makeMatch();
    put(match, { R1: 50 });
    expect(pieceById(match, "R1").boardSquare).toBe(49);
    put(match, { R1: 52 });
    expect(pieceById(match, "R1").boardSquare).toBeNull();
    put(match, { R1: 57 });
    expect(pieceById(match, "R1").boardSquare).toBeNull();
  });
});

describe("captures (G-7)", () => {
  it("captures on a non-safe square and sends the piece to its yard", () => {
    const match = makeMatch();
    put(match, { R1: 3, G1: 45 }); // G1 is on square 5, three ahead of R1
    applyRoll(match, 3);
    const move = moveFor(match, "R1");
    expect(move.captures).toEqual(["G1"]);

    const events = applyMove(match, move);
    expect(events).toContain("CAPTURED");
    expect(pieceById(match, "G1")).toMatchObject({ step: 0, boardSquare: null });
  });

  it("does not capture on a safe square", () => {
    const match = makeMatch();
    put(match, { R1: 7, G1: 48 }); // square 8 is safe by default
    applyRoll(match, 2);
    expect(moveFor(match, "R1").captures).toEqual([]);
  });

  it("reads safe squares from the rules, not from a fixed list", () => {
    const match = makeMatch(4, { safeSquares: [5] });
    put(match, { R1: 3, G1: 45 });
    applyRoll(match, 3);
    expect(moveFor(match, "R1").captures).toEqual([]);
  });

  it("captures every opposing piece on the square, and never its own", () => {
    const match = makeMatch();
    put(match, { R1: 3, R2: 6, G1: 45, G2: 45 });
    applyRoll(match, 3);
    expect(moveFor(match, "R1").captures).toEqual(["G1", "G2"]);
  });
});

describe("bonus turns (G-8)", () => {
  function moveAfterRoll(match: Match, roll: number, id: string): string[] {
    applyRoll(match, roll);
    return applyMove(match, moveFor(match, id));
  }

  it("gives another turn after a 6", () => {
    const match = makeMatch();
    expect(moveAfterRoll(match, 6, "R1")).toContain("BONUS_TURN");
    expect(match.turn).toMatchObject({ activePlayerId: "p1", phase: "AWAITING_ROLL" });
  });

  it("moves on after an ordinary roll", () => {
    const match = makeMatch();
    put(match, { R1: 10 });
    expect(moveAfterRoll(match, 2, "R1")).toContain("TURN_CHANGED");
    expect(match.turn.activePlayerId).toBe("p2");
  });

  it("gives another turn after a capture", () => {
    const match = makeMatch();
    put(match, { R1: 3, G1: 45 });
    expect(moveAfterRoll(match, 3, "R1")).toContain("BONUS_TURN");
  });

  it("gives another turn after finishing a piece", () => {
    const match = makeMatch();
    put(match, { R1: 55 });
    expect(moveAfterRoll(match, 2, "R1")).toEqual(["MOVED", "PIECE_FINISHED", "BONUS_TURN"]);
  });

  it("follows the rule switches", () => {
    const off = { bonusOnSix: false, bonusOnCapture: false, bonusOnFinish: false };

    const six = makeMatch(4, off);
    expect(moveAfterRoll(six, 6, "R1")).toContain("TURN_CHANGED");

    const capture = makeMatch(4, off);
    put(capture, { R1: 3, G1: 45 });
    expect(moveAfterRoll(capture, 3, "R1")).toContain("TURN_CHANGED");

    const finish = makeMatch(4, off);
    put(finish, { R1: 55 });
    expect(moveAfterRoll(finish, 2, "R1")).toContain("TURN_CHANGED");
  });
});

describe("three sixes (G-9)", () => {
  function rollThreeSixes(match: Match): string[] {
    applyRoll(match, 6);
    applyMove(match, moveFor(match, "R1"));
    applyRoll(match, 6);
    applyMove(match, moveFor(match, "R1"));
    return applyRoll(match, 6);
  }

  it("ends the turn on the third six and keeps the die value", () => {
    const match = makeMatch();
    expect(rollThreeSixes(match)).toEqual(["ROLLED", "TURN_FORFEITED", "TURN_CHANGED"]);
    expect(match.turn).toMatchObject({ activePlayerId: "p2", sixesInRow: 0, lastRoll: 6 });
  });

  it("counts sixes in the turn and resets on another number", () => {
    const match = makeMatch();
    applyRoll(match, 6);
    expect(match.turn.sixesInRow).toBe(1);
    applyMove(match, moveFor(match, "R1"));
    applyRoll(match, 2);
    expect(match.turn.sixesInRow).toBe(0);
  });

  it("can be switched off, and never reports more than 2", () => {
    const match = makeMatch(4, { threeSixesForfeit: false });
    expect(rollThreeSixes(match)).toEqual(["ROLLED"]);
    expect(match.turn).toMatchObject({ activePlayerId: "p1", sixesInRow: 2 });
  });
});

describe("no legal move (G-10)", () => {
  it("shows the roll with no moves, and only then passes the turn", () => {
    const match = makeMatch();
    expect(applyRoll(match, 3)).toEqual(["ROLLED"]);
    expect(match.turn).toMatchObject({
      activePlayerId: "p1",
      phase: "AWAITING_MOVE",
      lastRoll: 3,
      legalMoves: [],
    });
    expect(passTurn(match)).toEqual(["TURN_PASSED", "TURN_CHANGED"]);
    expect(match.turn).toMatchObject({ activePlayerId: "p2", phase: "AWAITING_ROLL" });
  });
});

describe("turn order", () => {
  it("goes clockwise and wraps round", () => {
    const match = makeMatch();
    const seen = [match.turn.activePlayerId];
    for (let index = 0; index < 4; index += 1) {
      passTurn(match);
      seen.push(match.turn.activePlayerId);
    }
    expect(seen).toEqual(["p1", "p2", "p3", "p4", "p1"]);
  });

  it("alternates between opposite corners in a 2-player game (R1)", () => {
    const match = makeMatch(2);
    expect(match.players.map(({ colour }) => colour)).toEqual(["RED", "YELLOW"]);
    expect(match.pieces.map(({ id }) => id)).toEqual([
      "R1",
      "R2",
      "R3",
      "R4",
      "Y1",
      "Y2",
      "Y3",
      "Y4",
    ]);

    const seen = [match.turn.activePlayerId];
    passTurn(match);
    seen.push(match.turn.activePlayerId);
    passTurn(match);
    seen.push(match.turn.activePlayerId);
    expect(seen).toEqual(["p1", "p2", "p1"]);
  });

  it("uses no deadline when the timer is off", () => {
    const match = makeMatch(4, { turnTimerSeconds: 0 });
    expect(match.turn.deadline).toBeNull();
    passTurn(match);
    expect(match.turn.deadline).toBeNull();
  });
});

describe("winning (G-11)", () => {
  function nearWin(): Match {
    const match = makeMatch();
    put(match, { R1: 57, R2: 57, R3: 57, R4: 54, Y1: 40, G1: 12 });
    const red = match.players[0];
    if (red) red.piecesHome = 3;
    return match;
  }

  it("ends the match on the fourth piece home", () => {
    const match = nearWin();
    applyRoll(match, 3);
    const events = applyMove(match, moveFor(match, "R4"));
    expect(events).toEqual(["MOVED", "PIECE_FINISHED", "GAME_OVER"]);
    expect(match.status).toBe("FINISHED");
    expect(match.winnerId).toBe("p1");
    expect(match.turn.legalMoves).toEqual([]);
  });

  it("ranks the winner first and everyone else by progress", () => {
    const match = nearWin();
    applyRoll(match, 3);
    applyMove(match, moveFor(match, "R4"));
    expect(match.ranking).toEqual(["p1", "p3", "p2", "p4"]);
  });

  it("only reveals the seed once the match is over", () => {
    const match = nearWin();
    const running = toSnapshot(match);
    expect(running).not.toHaveProperty("seed");
    expect(running).not.toHaveProperty("winnerId");
    expect(running).not.toHaveProperty("draws");

    applyRoll(match, 3);
    applyMove(match, moveFor(match, "R4"));
    expect(toSnapshot(match).seed).toBe("test-seed");
  });
});

describe("refusing a move", () => {
  function codeForMove(match: Match, playerId: string, pieceId: string): string {
    return codeOf(() => requireLegalMove(match, playerId, pieceId));
  }

  it("uses the right code for each mistake", () => {
    const match = makeMatch();
    expect(codeOf(() => requireLegalMove(null, "p1", "R1"))).toBe("GAME_NOT_STARTED");
    expect(codeForMove(match, "p2", "G1")).toBe("NOT_YOUR_TURN");
    expect(codeForMove(match, "p1", "R1")).toBe("ROLL_REQUIRED");

    applyRoll(match, 6);
    expect(codeForMove(match, "p1", "Z9")).toBe("PIECE_NOT_FOUND");
    expect(codeForMove(match, "p1", "G1")).toBe("ILLEGAL_MOVE");
  });

  it("explains why a yard piece can't move", () => {
    const match = makeMatch();
    put(match, { R2: 10 });
    applyRoll(match, 3);
    expect(() => requireLegalMove(match, "p1", "R1")).toThrow(
      "A piece needs a 6 to leave the yard.",
    );
  });
});

describe("the computer", () => {
  it("scores moves by the agreed table", () => {
    const match = makeMatch();
    const score = (move: Partial<LegalMove>) =>
      scoreMove(match, { pieceId: "R1", fromStep: 10, toStep: 12, captures: [], ...move });

    expect(score({ toStep: 57, fromStep: 55 })).toBe(100);
    expect(score({ captures: ["G1"], toStep: 6 })).toBe(80);
    expect(score({ fromStep: 0, toStep: 1 })).toBe(100); // leaving (60) onto safe square 0 (40)
    expect(score({ toStep: 9 })).toBe(40); // step 9 is safe square 8
    expect(score({ toStep: 12 })).toBeCloseTo(1.2);
  });

  it("prefers finishing to leaving the yard when they score the same", () => {
    const match = makeMatch();
    put(match, { R4: 51 });
    applyRoll(match, 6);
    expect(chooseMove(match, "NORMAL").pieceId).toBe("R4");
  });

  it("prefers a capture to a plain move", () => {
    const match = makeMatch();
    put(match, { R1: 3, R2: 20, G1: 45 });
    applyRoll(match, 3);
    expect(chooseMove(match, "NORMAL").pieceId).toBe("R1");
  });

  it("only ever picks a legal move on EASY", () => {
    const match = makeMatch();
    put(match, { R1: 3, R2: 20, R3: 30 });
    applyRoll(match, 3);
    for (let index = 0; index < 50; index += 1) {
      expect(legalIds(match)).toContain(chooseMove(match, "EASY").pieceId);
    }
  });
});

describe("whole games", () => {
  function playToTheEnd(match: Match, difficulty: Difficulty): void {
    for (let actions = 0; match.status === "IN_PROGRESS"; actions += 1) {
      if (actions > 50000) throw new Error("The game never finished");
      if (match.turn.phase === "AWAITING_ROLL") applyRoll(match, drawDie(match));
      else if (match.turn.legalMoves.length === 0) passTurn(match);
      else applyMove(match, chooseMove(match, difficulty));
    }
  }

  const cases = ([2, 3, 4] as const).flatMap((players) =>
    (["NORMAL", "EASY"] as const).flatMap((difficulty) =>
      ["seed-a", "seed-b", "seed-c"].map((seed) => ({ players, difficulty, seed })),
    ),
  );

  it.each(cases)("$players players on $difficulty ($seed) reach a winner", (game) => {
    const match = makeMatch(game.players, {}, game.seed);
    playToTheEnd(match, game.difficulty);

    const winner = match.players.find(({ id }) => id === match.winnerId);
    expect(match.status).toBe("FINISHED");
    expect(winner?.piecesHome).toBe(4);
    expect(match.ranking?.[0]).toBe(match.winnerId);
    expect(match.ranking).toHaveLength(game.players);
  });
});
