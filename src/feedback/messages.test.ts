import type { EventType, ServerEvent } from "@/contract/events";
import type { GameStateSnapshot } from "@/contract/types";
import { eventToMessage, mergedRollLine } from "@/feedback/messages";
import { FIXTURES } from "@/mock/fixtures";

// In the spread fixture Rida's pieces are on 0, 7, 30 and 54, and Hamza's third is on 14.
function ridasTurn(): GameStateSnapshot {
  const spread = FIXTURES.spread;
  if (!spread) throw new Error("the spread fixture exists");
  return { ...spread, turn: { ...spread.turn, activePlayerId: "p1", lastRoll: 4 } };
}

function event(type: EventType): ServerEvent {
  return { v: "1.0.0", version: 2, type, data: {} };
}

function after(
  steps: Record<string, number>,
  changes: Partial<GameStateSnapshot> = {},
): GameStateSnapshot {
  const before = ridasTurn();
  return {
    ...before,
    version: before.version + 1,
    pieces: before.pieces.map((piece) => {
      const step = steps[piece.id];
      return step === undefined ? piece : { ...piece, step };
    }),
    ...changes,
  };
}

function say(type: EventType, next = after({})): string | null {
  return eventToMessage(event(type), ridasTurn(), next);
}

describe("eventToMessage", () => {
  // docs/03-ui-spec.md §6, one test per template.
  it("says who goes first", () => {
    expect(eventToMessage(event("GAME_STARTED"), null, ridasTurn())).toBe(
      "Game started. Rida goes first.",
    );
  });

  it("says what was rolled", () => {
    const next = after({}, { turn: { ...ridasTurn().turn, lastRoll: 5 } });
    expect(say("ROLLED", next)).toBe("Rida rolled 5.");
  });

  // After three sixes the snapshot already belongs to the next player.
  it("names who rolled even when the turn has moved on", () => {
    const next = after({}, { turn: { ...ridasTurn().turn, activePlayerId: "p2", lastRoll: 6 } });
    expect(say("ROLLED", next)).toBe("Rida rolled 6.");
  });

  it("says how far a piece moved", () => {
    expect(say("MOVED", after({ R2: 10 }))).toBe("Rida moved a piece 3 squares.");
  });

  it("says one square, not one squares", () => {
    expect(say("MOVED", after({ R2: 8 }))).toBe("Rida moved a piece 1 square.");
  });

  it("says when a piece comes out of base", () => {
    expect(say("MOVED", after({ R1: 1 }))).toBe("Rida brought a piece out.");
  });

  it("names who was captured", () => {
    expect(say("CAPTURED", after({ R2: 10, G3: 0 }))).toBe("Rida captured Hamza's piece!");
  });

  it("finds each piece when several were captured", () => {
    const next = after({ G3: 0, Y1: 0 });
    expect(eventToMessage(event("CAPTURED"), ridasTurn(), next, 0)).toBe(
      "Rida captured Hamza's piece!",
    );
    expect(eventToMessage(event("CAPTURED"), ridasTurn(), next, 1)).toBe(
      "Rida captured Maryam's piece!",
    );
  });

  it("says when a piece gets home", () => {
    expect(say("PIECE_FINISHED")).toBe("Rida got a piece home!");
  });

  it("says who rolls again", () => {
    expect(say("BONUS_TURN")).toBe("Rida rolls again!");
  });

  it("says a turn was skipped", () => {
    expect(say("TURN_PASSED")).toBe("Rida can't move. Turn skipped.");
  });

  it("says a turn was lost to three sixes", () => {
    expect(say("TURN_FORFEITED")).toBe("Three 6s in a row — Rida's turn is over.");
  });

  it("names who dropped out", () => {
    const players = ridasTurn().players.map((player) =>
      player.id === "p2" ? { ...player, connected: false } : player,
    );
    expect(say("PLAYER_DISCONNECTED", after({}, { players }))).toBe(
      "Hamza left. The computer will play for them.",
    );
  });

  // In the spread fixture Maryam is the one who is offline.
  it("names who came back", () => {
    const players = ridasTurn().players.map((player) =>
      player.name === "Maryam" ? { ...player, connected: true } : player,
    );
    expect(say("PLAYER_RECONNECTED", after({}, { players }))).toBe("Maryam is back.");
  });

  it("names the winner the server gave", () => {
    expect(say("GAME_OVER", after({}, { winnerId: "p3" }))).toBe("Maryam wins!");
  });

  it.each<EventType>([
    "TURN_CHANGED",
    "PLAYER_LEFT",
    "PLAYER_IDLE",
    "GAME_ABANDONED",
    "GAME_RESTARTED",
  ])("has nothing to say for %s", (type) => {
    expect(say(type)).toBeNull();
  });

  // EXC-05-1: if the snapshots can't name it, there is no line. Never a guess.
  describe("won't guess", () => {
    it.each<EventType>(["ROLLED", "MOVED", "CAPTURED", "PIECE_FINISHED", "BONUS_TURN"])(
      "%s without the snapshot before it",
      (type) => {
        expect(eventToMessage(event(type), null, after({ R2: 10, G3: 0 }))).toBeNull();
      },
    );

    it("a capture when no piece went back", () => {
      expect(say("CAPTURED", after({ R2: 10 }))).toBeNull();
    });

    it("a move when no piece went forward", () => {
      expect(say("MOVED")).toBeNull();
    });

    it("a roll with no value", () => {
      const next = after({}, { turn: { ...ridasTurn().turn, lastRoll: null } });
      expect(say("ROLLED", next)).toBeNull();
    });

    it("a winner the server didn't name", () => {
      expect(say("GAME_OVER")).toBeNull();
    });

    it("who dropped out when nobody's connection changed", () => {
      expect(say("PLAYER_DISCONNECTED")).toBeNull();
    });
  });
});

describe("mergedRollLine", () => {
  const merge = (types: EventType[], next: GameStateSnapshot) =>
    mergedRollLine(types.map(event), ridasTurn(), next);

  it("joins a roll and a capture", () => {
    expect(merge(["MOVED", "CAPTURED"], after({ R2: 11, G3: 0 }))).toBe(
      "Rida rolled 4 and captured Hamza's piece!",
    );
  });

  it("joins a roll and a piece getting home", () => {
    expect(merge(["MOVED", "PIECE_FINISHED"], after({ R4: 57 }))).toBe(
      "Rida rolled 4 and got a piece home!",
    );
  });

  it("joins a roll and a piece coming out", () => {
    expect(merge(["MOVED"], after({ R1: 1 }))).toBe("Rida rolled 4 and brought a piece out.");
  });

  it("joins a roll and a plain move", () => {
    expect(merge(["MOVED"], after({ R2: 11 }))).toBe("Rida rolled 4 and moved a piece.");
  });

  it("has nothing to join when no move happened", () => {
    expect(merge(["TURN_PASSED"], after({}))).toBeNull();
  });

  it("has nothing to join without a roll", () => {
    const before = { ...ridasTurn(), turn: { ...ridasTurn().turn, lastRoll: null } };
    expect(mergedRollLine([event("MOVED")], before, after({ R2: 11 }))).toBeNull();
  });
});
