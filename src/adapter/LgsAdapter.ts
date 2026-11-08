// NFR-SYS-12: the GameAdapter for the real LGS and for our mock, which speak the same protocol.
// Only this folder may open a socket or call fetch (CLAUDE.md §3).

import { io, type Socket } from "socket.io-client";
import { v4 as uuid } from "uuid";
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

const API_PREFIX = "/api/v1";
const ACK_TIMEOUT_MS = 5000; // FR-SYS-04 EXC-04-1: a command never hangs

const UNREACHABLE: ServerError = {
  code: "INTERNAL_ERROR",
  message: "Could not reach the server.",
};
const NO_ANSWER: ServerError = { code: "INTERNAL_ERROR", message: "The server did not answer." };

interface StateMessage {
  snapshot: GameStateSnapshot;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isServerError(value: unknown): value is ServerError {
  return isRecord(value) && typeof value.code === "string" && typeof value.message === "string";
}

function readAck(response: unknown, sentRequestId: string | undefined): Ack {
  // FR-SYS-04 EXC-04-1: an incomplete reply is treated as a failure, never guessed at.
  if (!isRecord(response)) return { ok: false, error: NO_ANSWER };

  // A missing requestId is fine because the Ack type doesn't promise one (contract §8).
  // A different one means this reply belongs to some other press.
  const echoedId = response.requestId;
  if (sentRequestId !== undefined && echoedId !== undefined && echoedId !== sentRequestId) {
    return { ok: false, error: NO_ANSWER };
  }

  if (response.ok === true && typeof response.version === "number") {
    return { ok: true, version: response.version };
  }
  if (response.ok === false && isServerError(response.error)) {
    return { ok: false, error: response.error };
  }
  return { ok: false, error: NO_ANSWER };
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null; // an HTML error page, or an empty body
  }
}

// Contract §1: the server upper-cases the code, and the client should too, without spaces.
function cleanRoomCode(code: string): string {
  return encodeURIComponent(code.replace(/\s/g, "").toUpperCase());
}

export class LgsAdapter implements GameAdapter {
  private socket: Socket | null = null;
  private readonly handlers = new Set<AdapterHandlers>();

  constructor(
    private readonly serverUrl: string,
    private readonly ackTimeoutMs: number = ACK_TIMEOUT_MS,
  ) {}

  createRoom(req: CreateRoomRequest): Promise<Result<CreateRoomResponse>> {
    return this.post("/rooms", req);
  }

  joinRoom(code: string, req: JoinRoomRequest): Promise<Result<JoinRoomResponse>> {
    return this.post(`/rooms/${cleanRoomCode(code)}/join`, req);
  }

  previewRoom(code: string): Promise<Result<RoomPreview>> {
    return this.request(`/rooms/${cleanRoomCode(code)}`);
  }

  connect(sessionToken: string): void {
    this.disconnect(); // one socket per adapter

    const socket = io(this.serverUrl, { auth: { sessionToken } });
    this.socket = socket;
    let hasBeenLive = false;

    const setConnection = (status: ConnectionStatus) =>
      this.notify((handlers) => handlers.onConnection(status));

    setConnection("connecting");

    socket.on("connect", () => {
      hasBeenLive = true;
      setConnection("live");
    });

    // socket.active is false once socket.io has given up, such as when the server refuses the
    // session. While it is true socket.io keeps retrying by itself, so we write no retry loop.
    socket.on("connect_error", (error: Error & { data?: unknown }) => {
      if (!socket.active) {
        setConnection("lost");
        const { data } = error;
        if (isServerError(data)) this.notify((handlers) => handlers.onError(data));
        return;
      }
      setConnection(hasBeenLive ? "reconnecting" : "connecting");
    });

    socket.on("disconnect", () => setConnection(socket.active ? "reconnecting" : "lost"));

    socket.on("room:updated", (room: RoomSnapshot) =>
      this.notify((handlers) => handlers.onRoom(room)),
    );
    socket.on("game:state", (message: Partial<StateMessage> | undefined) => {
      // FR-SYS-04 EXC-04-1: without a snapshot there is nothing safe to apply (contract §8).
      const snapshot = message?.snapshot;
      if (snapshot) this.notify((handlers) => handlers.onState(snapshot));
    });
    socket.on("game:event", (event: ServerEvent) =>
      this.notify((handlers) => handlers.onEvent(event)),
    );
    socket.on("error", (error: ServerError) => this.notify((handlers) => handlers.onError(error)));
    socket.on("session:replaced", () => {
      // Contract §7: stop first, or two tabs keep taking the session from each other.
      this.disconnect();
      this.notify((handlers) => handlers.onSessionReplaced());
    });
  }

  disconnect(): void {
    const socket = this.socket;
    if (socket === null) return;
    this.socket = null;
    socket.off(); // we chose to leave, so nobody should hear a "connection lost" for it
    socket.disconnect();
  }

  addAi(seat: number, difficulty: Difficulty): Promise<Ack> {
    return this.send("room:addAi", { seat, difficulty });
  }

  leave(): Promise<Ack> {
    return this.send("room:leave", {});
  }

  start(opts: { fillEmptySeatsWithAi: boolean; aiDifficulty?: Difficulty }): Promise<Ack> {
    return this.send("game:start", opts);
  }

  roll(): Promise<Ack> {
    const requestId = uuid();
    return this.send("game:roll", { requestId }, requestId);
  }

  move(pieceId: string): Promise<Ack> {
    const requestId = uuid();
    return this.send("game:move", { pieceId, requestId }, requestId);
  }

  restart(): Promise<Ack> {
    return this.send("game:restart", {});
  }

  sync(knownVersion: number): Promise<Ack> {
    return this.send("state:sync", { knownVersion });
  }

  on(handlers: AdapterHandlers): () => void {
    this.handlers.add(handlers);
    return () => {
      this.handlers.delete(handlers);
    };
  }

  private notify(call: (handlers: AdapterHandlers) => void): void {
    this.handlers.forEach(call);
  }

  private send(event: string, payload: object, requestId?: string): Promise<Ack> {
    const socket = this.socket;
    if (socket === null) return Promise.resolve({ ok: false, error: UNREACHABLE });

    return new Promise((resolve) => {
      // socket.timeout() also drops the command if it is still waiting to be sent, so a press
      // that has already been reported as failed can't reach the server later.
      socket
        .timeout(this.ackTimeoutMs)
        .emit(event, payload, (timedOut: Error | null, response: unknown) => {
          resolve(timedOut ? { ok: false, error: NO_ANSWER } : readAck(response, requestId));
        });
    });
  }

  private post<T>(path: string, body: object): Promise<Result<T>> {
    return this.request(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  private async request<T>(path: string, init?: RequestInit): Promise<Result<T>> {
    let response: Response;
    try {
      response = await fetch(`${this.serverUrl}${API_PREFIX}${path}`, init);
    } catch {
      return { ok: false, error: UNREACHABLE };
    }

    const body = await readJson(response);
    if (response.ok && body !== null) return { ok: true, data: body as T };
    return { ok: false, error: isServerError(body) ? body : UNREACHABLE };
  }
}
