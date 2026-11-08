// The state manager (D3 §3.2). One source of truth: the latest accepted snapshot.
// Anything worked out from it is a selector below, never a second stored copy (CLAUDE.md §4).

import { createStore, type StoreApi } from "zustand/vanilla";
import type { Ack, ConnectionStatus, GameAdapter } from "@/adapter/GameAdapter";
import { pieceCell, progressCounts, type GridPoint } from "@/config/geometry";
import { RESYNC_CODES } from "@/contract/errors";
import type { ServerEvent } from "@/contract/events";
import type {
  GameStateSnapshot,
  LegalMove,
  Piece,
  Player,
  RoomSnapshot,
  ServerError,
} from "@/contract/types";
import { friendlyError, SESSION_REPLACED_MESSAGE } from "@/feedback/copy";

const EVENT_LOG_LIMIT = 50;

type CommandRequest = { kind: "roll" } | { kind: "move"; pieceId: string };

export type PendingCommand = CommandRequest & { id: number };

export interface Toast {
  id: number;
  message: string;
}

interface GameData {
  snapshot: GameStateSnapshot | null;
  room: RoomSnapshot | null;
  myPlayerId: string | null;
  connection: ConnectionStatus | null; // null until connect() has been called
  lastEvent: ServerEvent | null;
  eventLog: ServerEvent[];
  pendingCommand: PendingCommand | null;
  toasts: Toast[];
}

export interface GameState extends GameData {
  applySnapshot(next: GameStateSnapshot): void;
  applyEvent(event: ServerEvent): void;
  applyRoom(room: RoomSnapshot): void;
  applyConnection(status: ConnectionStatus): void;
  roll(): Promise<void>;
  move(pieceId: string): Promise<void>;
  resync(): Promise<void>;
  reset(): void;
  /** Starts feeding adapter messages into this store. Returns the function that stops it. */
  listen(): () => void;
  /** Temporary, for the P3 debug line. P5 replaces it with the real create and join flow. */
  startDebugGame(): Promise<void>;
}

export type GameStore = StoreApi<GameState>;

const INITIAL_DATA: GameData = {
  snapshot: null,
  room: null,
  myPlayerId: null,
  connection: null,
  lastEvent: null,
  eventLog: [],
  pendingCommand: null,
  toasts: [],
};

export function createGameStore(adapter: GameAdapter): GameStore {
  let nextId = 1;

  return createStore<GameState>((set, get) => {
    function pushToast(message: string): void {
      set((state) => ({ toasts: [...state.toasts, { id: nextId++, message }] }));
    }

    function showError(error: ServerError): void {
      pushToast(friendlyError(error));
      // Contract §6: these codes mean our copy of the game is out of date.
      if (RESYNC_CODES.includes(error.code)) void get().resync();
    }

    async function sendCommand(request: CommandRequest, send: () => Promise<Ack>): Promise<void> {
      // FR-SYS-02 EXC-02-1: extra presses while one is in flight do nothing.
      if (get().pendingCommand !== null) return;

      const pending: PendingCommand = { ...request, id: nextId++ };
      set({ pendingCommand: pending });
      const ack = await send();

      // The store was reset while this was in flight, so the answer is about a press that no
      // longer matters. It must not clear a newer command or show an old error.
      if (get().pendingCommand?.id !== pending.id) return;

      set({ pendingCommand: null });
      // FR-SYS-04 POST-04-1: nothing here touches the snapshot. Changes only come as game:state.
      if (!ack.ok) showError(ack.error);
    }

    return {
      ...INITIAL_DATA,

      applySnapshot: (next) => {
        const current = get().snapshot;
        // Contract §8: a restart begins again at version 1 with a new matchId, so comparing
        // versions across two matches would throw away every snapshot of the new one.
        if (current !== null && current.matchId === next.matchId) {
          if (next.version <= current.version) return; // NFR-SYS-04: stale, keep what we have
          if (next.version > current.version + 1) void adapter.sync(current.version);
        }
        set({ snapshot: next });
      },

      // FR-SYS-05: events drive animation, sound and messages. They never move a piece.
      applyEvent: (event) =>
        set((state) => ({
          lastEvent: event,
          eventLog: [...state.eventLog, event].slice(-EVENT_LOG_LIMIT),
        })),

      applyRoom: (room) => set({ room }),

      applyConnection: (status) => {
        const wasReconnecting = get().connection === "reconnecting";
        set({ connection: status });
        if (status === "live" && wasReconnecting) void get().resync();
      },

      roll: () => sendCommand({ kind: "roll" }, () => adapter.roll()),

      move: (pieceId) => sendCommand({ kind: "move", pieceId }, () => adapter.move(pieceId)),

      // The reply arrives as game:state and goes through the usual version check. A failed
      // sync changes nothing, and it can't trigger another sync, so this can never loop.
      resync: async () => {
        await adapter.sync(get().snapshot?.version ?? 0);
      },

      // Leaves connection alone because the socket's state doesn't change here.
      reset: () => set({ ...INITIAL_DATA, connection: get().connection }),

      listen: () =>
        adapter.on({
          onRoom: (room) => get().applyRoom(room),
          onState: (snapshot) => get().applySnapshot(snapshot),
          onEvent: (event) => get().applyEvent(event),
          onError: showError,
          onConnection: (status) => get().applyConnection(status),
          onSessionReplaced: () => {
            set({ connection: "lost" });
            pushToast(SESSION_REPLACED_MESSAGE);
          },
        }),

      startDebugGame: async () => {
        const created = await adapter.createRoom({
          displayName: "Tester",
          mode: "HUMAN_VS_AI",
          seats: 4,
        });
        if (!created.ok) {
          showError(created.error);
          return;
        }

        set({ myPlayerId: created.data.playerId, room: created.data.room });
        adapter.connect(created.data.sessionToken);
        const started = await adapter.start({ fillEmptySeatsWithAi: false });
        if (!started.ok) showError(started.error);
      },
    };
  });
}

// ---- selectors ----

// Zustand 5 re-renders forever if a selector returns a new object on every call, so these
// answer from a cache tied to the snapshot. A new snapshot gets a new answer, so it can't go stale.
function perSnapshot<T>(
  compute: (snapshot: GameStateSnapshot) => T,
): (snapshot: GameStateSnapshot) => T {
  const cache = new WeakMap<GameStateSnapshot, T>();
  return (snapshot) => {
    const cached = cache.get(snapshot);
    if (cached !== undefined) return cached;
    const value = compute(snapshot);
    cache.set(snapshot, value);
    return value;
  };
}

export function selectIsMyTurn(state: GameState): boolean {
  const { snapshot, myPlayerId } = state;
  return snapshot?.status === "IN_PROGRESS" && snapshot.turn.activePlayerId === myPlayerId;
}

export function selectCanRoll(state: GameState): boolean {
  return (
    selectIsMyTurn(state) &&
    state.snapshot?.turn.phase === "AWAITING_ROLL" &&
    state.pendingCommand === null
  );
}

export function selectCanMove(state: GameState): boolean {
  return (
    selectIsMyTurn(state) &&
    state.snapshot?.turn.phase === "AWAITING_MOVE" &&
    state.snapshot.turn.legalMoves.length > 0 &&
    state.pendingCommand === null
  );
}

const NO_PIECE_IDS: readonly string[] = [];
const legalPieceIds = perSnapshot((snapshot) =>
  snapshot.turn.legalMoves.map((move) => move.pieceId),
);

/** What the server lists for the active player. Pair with selectCanMove before allowing a press. */
export function selectLegalPieceIds(state: GameState): readonly string[] {
  return state.snapshot ? legalPieceIds(state.snapshot) : NO_PIECE_IDS;
}

export function selectLegalMoveFor(pieceId: string) {
  return (state: GameState): LegalMove | null =>
    state.snapshot?.turn.legalMoves.find((move) => move.pieceId === pieceId) ?? null;
}

export function selectActivePlayer(state: GameState): Player | null {
  const { snapshot } = state;
  if (!snapshot) return null;
  return snapshot.players.find((player) => player.id === snapshot.turn.activePlayerId) ?? null;
}

export function selectMe(state: GameState): Player | null {
  const { snapshot, room, myPlayerId } = state;
  const inGame = snapshot?.players.find((player) => player.id === myPlayerId);
  if (inGame) return inGame;
  // Before a match starts there is no snapshot, only the lobby's seats.
  return room?.seats.find((seat) => seat.player?.id === myPlayerId)?.player ?? null;
}

export type ProgressCounts = ReturnType<typeof progressCounts>;

const progressByPlayer = perSnapshot(
  (snapshot) =>
    new Map(
      snapshot.players.map((player) => [player.id, progressCounts(snapshot.pieces, player.colour)]),
    ),
);

export function selectProgress(playerId: string) {
  return (state: GameState): ProgressCounts | null =>
    state.snapshot ? (progressByPlayer(state.snapshot).get(playerId) ?? null) : null;
}

export function cellKey(point: GridPoint): string {
  return `${point.col}:${point.row}`;
}

const NO_PIECES: ReadonlyMap<string, readonly Piece[]> = new Map();
const piecesByCell = perSnapshot((snapshot) => {
  const cells = new Map<string, Piece[]>();
  for (const piece of snapshot.pieces) {
    const key = cellKey(pieceCell(piece));
    cells.set(key, [...(cells.get(key) ?? []), piece]);
  }
  return cells as ReadonlyMap<string, readonly Piece[]>;
});

/** Pieces grouped by the cell they sit on. Look a cell up with cellKey. */
export function selectPiecesByCell(state: GameState): ReadonlyMap<string, readonly Piece[]> {
  return state.snapshot ? piecesByCell(state.snapshot) : NO_PIECES;
}

/** Null when the turn has no time limit. Takes the time so a countdown can tick on its own. */
export function selectSecondsLeft(now: number) {
  return (state: GameState): number | null => {
    const deadline = state.snapshot?.turn.deadline;
    if (!deadline) return null;
    const millisLeft = Date.parse(deadline) - now;
    return Number.isNaN(millisLeft) ? null : Math.max(0, Math.ceil(millisLeft / 1000));
  };
}

export function selectIsComputerTurn(state: GameState): boolean {
  return state.snapshot?.status === "IN_PROGRESS" && selectActivePlayer(state)?.isAi === true;
}
