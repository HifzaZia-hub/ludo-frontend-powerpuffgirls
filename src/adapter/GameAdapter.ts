// NFR-SYS-12: the only way from the app to game logic and AI, so either can be replaced
// without redesigning the UI. Mirrors docs/01-contract.md §9. Types only.

import type { ServerEvent } from "@/contract/events";
import type {
  CreateRoomRequest,
  CreateRoomResponse,
  Difficulty,
  GameStateSnapshot,
  JoinRoomRequest,
  JoinRoomResponse,
  RoomSnapshot,
  ServerError,
} from "@/contract/types";

export type Ack = { ok: true; version: number } | { ok: false; error: ServerError };

export type Result<T> = { ok: true; data: T } | { ok: false; error: ServerError };

export type ConnectionStatus = "connecting" | "live" | "reconnecting" | "lost";

// The contract describes a room preview but names none of its fields (docs/01-contract.md §8),
// so nothing may read inside one until the backend team answers.
export type RoomPreview = unknown;

export interface AdapterHandlers {
  onRoom(room: RoomSnapshot): void;
  onState(snapshot: GameStateSnapshot): void;
  onEvent(event: ServerEvent): void;
  onError(error: ServerError): void;
  onConnection(status: ConnectionStatus): void;
  onSessionReplaced(): void;
}

export interface GameAdapter {
  // setup (REST in the LGS implementation)
  createRoom(req: CreateRoomRequest): Promise<Result<CreateRoomResponse>>;
  joinRoom(code: string, req: JoinRoomRequest): Promise<Result<JoinRoomResponse>>;
  previewRoom(code: string): Promise<Result<RoomPreview>>;

  // live session
  connect(sessionToken: string): void;
  disconnect(): void;

  // commands: every one resolves to an Ack and never throws
  addAi(seat: number, difficulty: Difficulty): Promise<Ack>;
  leave(): Promise<Ack>;
  start(opts: { fillEmptySeatsWithAi: boolean; aiDifficulty?: Difficulty }): Promise<Ack>;
  roll(): Promise<Ack>;
  move(pieceId: string): Promise<Ack>;
  restart(): Promise<Ack>;
  sync(knownVersion: number): Promise<Ack>;

  // incoming: returns an unsubscribe function
  on(handlers: AdapterHandlers): () => void;
}
