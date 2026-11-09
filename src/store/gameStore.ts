// The state manager (D3 §3.2). One source of truth: the latest accepted snapshot.
// Anything worked out from it is a selector below, never a second stored copy (CLAUDE.md §4).

import { createStore, type StoreApi } from "zustand/vanilla";
import type { Ack, ConnectionStatus, GameAdapter } from "@/adapter/GameAdapter";
import { cellKey, pieceCell, pieceNumber, piecePlace, progressCounts } from "@/config/geometry";
import { FIELD_ERRORS, RESYNC_CODES, type FormField } from "@/contract/errors";
import type { ServerEvent } from "@/contract/events";
import type {
  CreateRoomRequest,
  Difficulty,
  GameStateSnapshot,
  JoinRoomResponse,
  LegalMove,
  Piece,
  Player,
  RoomSnapshot,
  ServerError,
} from "@/contract/types";
import { friendlyError, moveChoiceText, SESSION_REPLACED_MESSAGE } from "@/feedback/copy";
import { clearSavedSession, saveSession } from "@/store/savedSession";

const EVENT_LOG_LIMIT = 50;

type CommandRequest =
  | { kind: "roll" }
  | { kind: "move"; pieceId: string }
  | { kind: "addAi"; seat: number }
  | { kind: "start" }
  | { kind: "restart" }
  | { kind: "leave" };

export type PendingCommand = CommandRequest & { id: number };

export interface Toast {
  id: number;
  kind: "info" | "error";
  message: string;
}

/** A form's request failed. With no field, the problem isn't about anything the player typed. */
export interface FormFailure {
  ok: false;
  field: FormField | null;
  message: string;
}

export type FormResult = { ok: true } | FormFailure;

function formFailure(error: ServerError): FormFailure {
  return { ok: false, field: FIELD_ERRORS[error.code] ?? null, message: friendlyError(error) };
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
  /** D2 FR-29: wins per player id. A history across matches, so no snapshot can hold it. */
  sessionWins: Readonly<Record<string, number>>;
  scoredMatchId: string | null;
}

export interface GameState extends GameData {
  applySnapshot(next: GameStateSnapshot): void;
  applyEvent(event: ServerEvent): void;
  applyRoom(room: RoomSnapshot): void;
  applyConnection(status: ConnectionStatus): void;
  /** Resolves to the version the server gave this roll, or null if it didn't happen. */
  roll(): Promise<number | null>;
  /** Resolves to the version the server gave this move, or null if it didn't happen. */
  move(pieceId: string): Promise<number | null>;
  resync(): Promise<void>;
  reset(): void;
  /** Starts feeding adapter messages into this store. Returns the function that stops it. */
  listen(): () => void;
  createRoom(request: CreateRoomRequest): Promise<FormResult>;
  joinRoom(code: string, displayName: string): Promise<FormResult>;
  /** Only says whether the code found a game. See the note in the function. */
  previewRoom(code: string): Promise<FormResult>;
  addAi(seat: number, difficulty: Difficulty): Promise<void>;
  startGame(options: { fillEmptySeatsWithAi: boolean }): Promise<void>;
  /** True once the server has accepted it and this tab has let go of the room. */
  leaveRoom(): Promise<boolean>;
  /** True once the server has accepted it. The new match arrives as game:state. */
  restart(): Promise<boolean>;
  /** Lets go of a room the server has already closed, so there is nothing left to ask it. */
  forgetRoom(): void;
  dismissToast(id: number): void;
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
  sessionWins: {},
  scoredMatchId: null,
};

export function createGameStore(adapter: GameAdapter): GameStore {
  let nextId = 1;

  return createStore<GameState>((set, get) => {
    function pushToast(message: string): void {
      // Error toasts stay until dismissed, so retrying the same failure must not stack them up.
      set((state) =>
        state.toasts.some((toast) => toast.message === message)
          ? state
          : { toasts: [...state.toasts, { id: nextId++, kind: "error", message }] },
      );
    }

    function enterRoom({
      playerId,
      sessionToken,
      room,
    }: Pick<JoinRoomResponse, "playerId" | "sessionToken" | "room">): void {
      saveSession({ sessionToken, playerId, roomCode: room.roomCode });
      // A fresh start also clears any error left over from the attempts before this one.
      set({ ...INITIAL_DATA, myPlayerId: playerId, room });
      adapter.connect(sessionToken);
    }

    function endSession(): void {
      adapter.disconnect();
      clearSavedSession();
      set(INITIAL_DATA);
    }

    function showError(error: ServerError): void {
      // Contract §6: the server no longer knows this session, so there is no room to stay in.
      if (error.code === "UNAUTHORIZED") endSession();
      pushToast(friendlyError(error));
      // Contract §6: these codes mean our copy of the game is out of date.
      if (RESYNC_CODES.includes(error.code)) void get().resync();
    }

    // The server's answer, or null if this press didn't count.
    async function sendCommand(
      request: CommandRequest,
      send: () => Promise<Ack>,
    ): Promise<Ack | null> {
      // FR-SYS-02 EXC-02-1: extra presses while one is in flight do nothing.
      if (get().pendingCommand !== null) return null;

      const pending: PendingCommand = { ...request, id: nextId++ };
      set({ pendingCommand: pending });
      const ack = await send();

      // The store was reset while this was in flight, so the answer is about a press that no
      // longer matters. It must not clear a newer command or show an old error.
      if (get().pendingCommand?.id !== pending.id) return null;

      set({ pendingCommand: null });
      // FR-SYS-04 POST-04-1: nothing here touches the snapshot. Changes only come as game:state.
      if (!ack.ok) showError(ack.error);
      return ack;
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
        const { sessionWins, scoredMatchId } = get();
        // POST-06-3, EXC-06-1: only ever the winner the server named, and once per match even if
        // the same result arrives again after a resync.
        if (next.status === "FINISHED" && next.winnerId && next.matchId !== scoredMatchId) {
          set({
            snapshot: next,
            scoredMatchId: next.matchId,
            sessionWins: {
              ...sessionWins,
              [next.winnerId]: (sessionWins[next.winnerId] ?? 0) + 1,
            },
          });
          return;
        }
        set({ snapshot: next });
      },

      // FR-SYS-05: events drive animation, sound and messages. They never move a piece.
      applyEvent: (event) =>
        set((state) => ({
          lastEvent: event,
          // A restart begins again at version 1, so old events could be mistaken for new ones.
          eventLog:
            event.type === "GAME_RESTARTED"
              ? [event]
              : [...state.eventLog, event].slice(-EVENT_LOG_LIMIT),
        })),

      applyRoom: (room) => set({ room }),

      applyConnection: (status) => {
        const wasReconnecting = get().connection === "reconnecting";
        set({ connection: status });
        if (status === "live" && wasReconnecting) void get().resync();
      },

      roll: async () => {
        const ack = await sendCommand({ kind: "roll" }, () => adapter.roll());
        return ack?.ok ? ack.version : null;
      },

      // FR-SYS-03 EXC-03-2: nothing moves here. The piece moves when the new game:state arrives.
      move: async (pieceId) => {
        const ack = await sendCommand({ kind: "move", pieceId }, () => adapter.move(pieceId));
        return ack?.ok ? ack.version : null;
      },

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

      createRoom: async (request) => {
        const created = await adapter.createRoom(request);
        if (!created.ok) {
          const failure = formFailure(created.error);
          if (failure.field === null) pushToast(failure.message);
          return failure;
        }

        enterRoom(created.data);
        // Contract §1: the computer seats are filled already, so nothing is left to wait for.
        // If this fails the room still exists, and the lobby's Start button is the retry.
        if (request.mode === "HUMAN_VS_AI") {
          await get().startGame({ fillEmptySeatsWithAi: false });
        }
        return { ok: true };
      },

      // Join runs inside a modal, which blocks a toast behind it, so the form shows every
      // failure itself. Unlike createRoom, this one pushes no toast.
      joinRoom: async (code, displayName) => {
        const joined = await adapter.joinRoom(code, { displayName });
        if (!joined.ok) return formFailure(joined.error);
        enterRoom(joined.data);
        return { ok: true };
      },

      // Contract §8: the preview's field names are still an open question and we never guess
      // one, so this doesn't read inside it. "2 of 4 players" waits for the backend's answer.
      previewRoom: async (code) => {
        const preview = await adapter.previewRoom(code);
        return preview.ok ? { ok: true } : formFailure(preview.error);
      },

      // POST-07-2: the seat list only ever changes when room:updated arrives.
      addAi: async (seat, difficulty) => {
        await sendCommand({ kind: "addAi", seat }, () => adapter.addAi(seat, difficulty));
      },

      startGame: async (options) => {
        await sendCommand({ kind: "start" }, () => adapter.start(options));
      },

      leaveRoom: async () => {
        const ack = await sendCommand({ kind: "leave" }, () => adapter.leave());
        const left = ack?.ok === true;
        // FR-SYS-08 POST-08-3: a failed leave keeps everything, and the player can try again.
        if (left) endSession();
        return left;
      },

      // FR-SYS-08 POST-08-3: a failure is explained by sendCommand and the game stays as it was.
      restart: async () => {
        const ack = await sendCommand({ kind: "restart" }, () => adapter.restart());
        return ack?.ok === true;
      },

      forgetRoom: endSession,

      dismissToast: (id) =>
        set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
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
    state.pendingCommand === null &&
    state.connection === "live"
  );
}

/** True when the server has listed moves for this player to choose between. */
export function selectMoveOffered(state: GameState): boolean {
  const { snapshot } = state;
  if (!selectIsMyTurn(state) || snapshot?.turn.phase !== "AWAITING_MOVE") return false;
  const { legalMoves } = snapshot.turn;
  // With this rule on, the server plays a lone option itself, so there is nothing to choose.
  if (snapshot.rules.autoMoveSingleOption && legalMoves.length === 1) return false;
  return legalMoves.length > 0;
}

export type TurnKind = "myRoll" | "myMove" | "myAutoMove" | "noMove" | "human" | "computer";

/** Which turn message to show. Null when no match is running. */
export function selectTurnKind(state: GameState): TurnKind | null {
  const { snapshot, myPlayerId } = state;
  const active = selectActivePlayer(state);
  if (snapshot?.status !== "IN_PROGRESS" || !active) return null;
  // Contract §4: the server pauses on a roll with no move, and this names who it happened to.
  // TURN_PASSED can't say, because the contract names no fields for it (§8).
  if (snapshot.turn.phase === "AWAITING_MOVE" && snapshot.turn.legalMoves.length === 0) {
    return "noMove";
  }
  if (active.id === myPlayerId) {
    if (snapshot.turn.phase === "AWAITING_ROLL") return "myRoll";
    return selectMoveOffered(state) ? "myMove" : "myAutoMove";
  }
  return active.isAi ? "computer" : "human";
}

export function selectCanMove(state: GameState): boolean {
  return selectMoveOffered(state) && state.pendingCommand === null && state.connection === "live";
}

/** One of the server's moves, with what the screen says about it. */
export interface MoveOption extends LegalMove {
  number: string;
  phrase: string;
}

function moveOption(snapshot: GameStateSnapshot, move: LegalMove): MoveOption {
  const capturedNames = move.captures.flatMap((pieceId) => {
    const colour = snapshot.pieces.find(({ id }) => id === pieceId)?.colour;
    const owner = snapshot.players.find((player) => player.colour === colour);
    return owner ? [owner.name] : [];
  });
  return {
    ...move,
    number: pieceNumber(move.pieceId),
    phrase: moveChoiceText(
      piecePlace(move.fromStep),
      piecePlace(move.toStep),
      move.toStep - move.fromStep,
      capturedNames,
    ),
  };
}

const NO_MOVE_OPTIONS: readonly MoveOption[] = [];
const moveOptions = perSnapshot((snapshot) =>
  snapshot.turn.legalMoves.map((move) => moveOption(snapshot, move)),
);

/** FR-SYS-03 POST-03-1: only ever the server's list, and empty when there's nothing to choose. */
export function selectMoveOptions(state: GameState): readonly MoveOption[] {
  return state.snapshot && selectMoveOffered(state) ? moveOptions(state.snapshot) : NO_MOVE_OPTIONS;
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

export function selectIsHost(state: GameState): boolean {
  return state.myPlayerId !== null && state.room?.hostId === state.myPlayerId;
}

export function selectHostName(state: GameState): string | null {
  const { room } = state;
  return room?.seats.find((seat) => seat.player?.id === room.hostId)?.player?.name ?? null;
}

export type ProgressCounts = ReturnType<typeof progressCounts>;

export interface PlayerProgress {
  player: Player;
  counts: ProgressCounts;
}

const NO_PROGRESS: readonly PlayerProgress[] = [];
const playerProgress = perSnapshot((snapshot) =>
  snapshot.players.map((player) => ({
    player,
    counts: progressCounts(snapshot.pieces, player.colour),
  })),
);

/** Every player with their counts. Never sorted: the contract names no turn-order field. */
export function selectPlayerProgress(state: GameState): readonly PlayerProgress[] {
  return state.snapshot ? playerProgress(state.snapshot) : NO_PROGRESS;
}

const progressByPlayer = perSnapshot(
  (snapshot) =>
    new Map(playerProgress(snapshot).map(({ player, counts }) => [player.id, counts])),
);

export function selectProgress(playerId: string) {
  return (state: GameState): ProgressCounts | null =>
    state.snapshot ? (progressByPlayer(state.snapshot).get(playerId) ?? null) : null;
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

/**
 * Null when there is no time limit. Works from the clock, so it can never drift. Rounds down so
 * the last second reads 0: the server acts the moment the deadline passes, so an exact zero would
 * last only milliseconds and the player would never see it.
 */
export function secondsUntil(deadline: string | null | undefined, now: number): number | null {
  if (!deadline) return null;
  const millisLeft = Date.parse(deadline) - now;
  return Number.isNaN(millisLeft) ? null : Math.max(0, Math.floor(millisLeft / 1000));
}

/** Null when the turn has no time limit. Takes the time so a countdown can tick on its own. */
export function selectSecondsLeft(now: number) {
  return (state: GameState): number | null => secondsUntil(state.snapshot?.turn.deadline, now);
}

export function selectIsComputerTurn(state: GameState): boolean {
  return state.snapshot?.status === "IN_PROGRESS" && selectActivePlayer(state)?.isAi === true;
}
