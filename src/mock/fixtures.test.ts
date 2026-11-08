import { FakeAdapter } from "@/adapter/FakeAdapter";
import { pieceCell, progressCounts, squareForStep } from "@/config/geometry";
import type { GameStateSnapshot } from "@/contract/types";
import { FIXTURE_PLAYER_ID, FIXTURES, showFixture } from "@/mock/fixtures";
import { createGameStore } from "@/store/gameStore";
import { useUiStore } from "@/store/uiStore";

function fixture(name: string): GameStateSnapshot {
  const snapshot = FIXTURES[name];
  if (!snapshot) throw new Error(`No fixture called ${name}`);
  return snapshot;
}

describe("fixtures", () => {
  it("has every fixture the task asks for", () => {
    expect(Object.keys(FIXTURES).sort()).toEqual(
      ["edges", "homeRun", "spread", "stacked", "start", "twoPlayer"].sort(),
    );
  });

  describe.each(Object.keys(FIXTURES))("%s", (name) => {
    const snapshot = fixture(name);

    it("has four pieces for every player and none for anyone else", () => {
      for (const player of snapshot.players) {
        expect(snapshot.pieces.filter((piece) => piece.colour === player.colour)).toHaveLength(4);
      }
      expect(snapshot.pieces).toHaveLength(snapshot.players.length * 4);
    });

    it("agrees with itself the way a real snapshot does", () => {
      for (const player of snapshot.players) {
        expect(progressCounts(snapshot.pieces, player.colour).home).toBe(player.piecesHome);
      }
      for (const piece of snapshot.pieces) {
        expect(piece.boardSquare).toBe(squareForStep(piece.colour, piece.step));
        expect(() => pieceCell(piece)).not.toThrow();
      }
    });

    it("names an active player who is in the game", () => {
      expect(snapshot.players.map(({ id }) => id)).toContain(snapshot.turn.activePlayerId);
    });
  });

  it("puts the two players of a two-player game in opposite corners (R1)", () => {
    expect(fixture("twoPlayer").players.map(({ colour }) => colour)).toEqual(["RED", "YELLOW"]);
  });

  it("really does put steps 1 and 51 on the board for every colour", () => {
    for (const colour of ["RED", "GREEN", "YELLOW", "BLUE"]) {
      const steps = fixture("edges").pieces.filter((piece) => piece.colour === colour);
      expect(steps.map(({ step }) => step)).toEqual([1, 51, 0, 0]);
    }
  });
});

describe("showFixture", () => {
  beforeEach(() => useUiStore.setState({ screen: "main", modal: null }));
  afterEach(() => vi.restoreAllMocks());

  it("loads the snapshot and opens the game screen", () => {
    const store = createGameStore(new FakeAdapter());

    showFixture("spread", store);

    expect(store.getState().snapshot).toBe(fixture("spread"));
    expect(store.getState().myPlayerId).toBe(FIXTURE_PLAYER_ID);
    expect(useUiStore.getState().screen).toBe("game");
  });

  it("says which names exist when given a wrong one", () => {
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const store = createGameStore(new FakeAdapter());

    showFixture("nope", store);

    expect(errorLog).toHaveBeenCalledWith(expect.stringContaining("twoPlayer"));
    expect(store.getState().snapshot).toBeNull();
    expect(useUiStore.getState().screen).toBe("main");
  });
});
