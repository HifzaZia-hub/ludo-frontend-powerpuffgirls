// For tests only. NFR-SYS-12: the store runs against this with no server and no network,
// which is the proof that the adapter really can be replaced.

import type {
  Ack,
  AdapterHandlers,
  ConnectionStatus,
  GameAdapter,
  Result,
  RoomPreview,
} from "@/adapter/GameAdapter";
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

export type SentCommand =
  | { name: "addAi"; seat: number; difficulty: Difficulty }
  | { name: "leave" }
  | { name: "start"; fillEmptySeatsWithAi: boolean; aiDifficulty?: Difficulty }
  | { name: "roll" }
  | { name: "move"; pieceId: string }
  | { name: "restart" }
  | { name: "sync"; knownVersion: number };

const NOT_SCRIPTED: Result<never> = {
  ok: false,
  error: { code: "INTERNAL_ERROR", message: "FakeAdapter: no result was set for this call." },
};

export class FakeAdapter implements GameAdapter {
  /** Every command the store has sent, oldest first. */
  readonly commands: SentCommand[] = [];
  /** Every create, join and preview the store has asked for, oldest first. */
  readonly createRequests: CreateRoomRequest[] = [];
  readonly joinRequests: { code: string; request: JoinRoomRequest }[] = [];
  readonly previewCodes: string[] = [];
  connectedToken: string | null = null;

  createRoomResult: Result<CreateRoomResponse> = NOT_SCRIPTED;
  joinRoomResult: Result<JoinRoomResponse> = NOT_SCRIPTED;
  previewRoomResult: Result<RoomPreview> = NOT_SCRIPTED;

  private readonly handlers = new Set<AdapterHandlers>();
  private readonly queuedAcks: Promise<Ack>[] = [];

  /** The next command answers with this. With nothing queued, a command succeeds. */
  queueAck(ack: Ack): void {
    this.queuedAcks.push(Promise.resolve(ack));
  }

  /** The next command stays unanswered until the returned function is called. */
  holdNextAck(): (ack: Ack) => void {
    let release: (ack: Ack) => void = () => undefined;
    this.queuedAcks.push(
      new Promise<Ack>((resolve) => {
        release = resolve;
      }),
    );
    return (ack) => release(ack);
  }

  pushRoom(room: RoomSnapshot): void {
    this.handlers.forEach((handlers) => handlers.onRoom(room));
  }

  pushState(snapshot: GameStateSnapshot): void {
    this.handlers.forEach((handlers) => handlers.onState(snapshot));
  }

  pushEvent(event: ServerEvent): void {
    this.handlers.forEach((handlers) => handlers.onEvent(event));
  }

  pushError(error: ServerError): void {
    this.handlers.forEach((handlers) => handlers.onError(error));
  }

  pushConnection(status: ConnectionStatus): void {
    this.handlers.forEach((handlers) => handlers.onConnection(status));
  }

  pushSessionReplaced(): void {
    this.handlers.forEach((handlers) => handlers.onSessionReplaced());
  }

  createRoom(request: CreateRoomRequest): Promise<Result<CreateRoomResponse>> {
    this.createRequests.push(request);
    return Promise.resolve(this.createRoomResult);
  }

  joinRoom(code: string, request: JoinRoomRequest): Promise<Result<JoinRoomResponse>> {
    this.joinRequests.push({ code, request });
    return Promise.resolve(this.joinRoomResult);
  }

  previewRoom(code: string): Promise<Result<RoomPreview>> {
    this.previewCodes.push(code);
    return Promise.resolve(this.previewRoomResult);
  }

  connect(sessionToken: string): void {
    this.connectedToken = sessionToken;
  }

  disconnect(): void {
    this.connectedToken = null;
  }

  addAi(seat: number, difficulty: Difficulty): Promise<Ack> {
    return this.record({ name: "addAi", seat, difficulty });
  }

  leave(): Promise<Ack> {
    return this.record({ name: "leave" });
  }

  start(opts: { fillEmptySeatsWithAi: boolean; aiDifficulty?: Difficulty }): Promise<Ack> {
    return this.record({ name: "start", ...opts });
  }

  roll(): Promise<Ack> {
    return this.record({ name: "roll" });
  }

  move(pieceId: string): Promise<Ack> {
    return this.record({ name: "move", pieceId });
  }

  restart(): Promise<Ack> {
    return this.record({ name: "restart" });
  }

  sync(knownVersion: number): Promise<Ack> {
    return this.record({ name: "sync", knownVersion });
  }

  on(handlers: AdapterHandlers): () => void {
    this.handlers.add(handlers);
    return () => {
      this.handlers.delete(handlers);
    };
  }

  private record(command: SentCommand): Promise<Ack> {
    this.commands.push(command);
    return this.queuedAcks.shift() ?? Promise.resolve({ ok: true, version: 0 });
  }
}
