// Socket.IO auth and commands from docs/01-contract.md §3.

import type { Server, Socket } from "socket.io";
import { CommandError, CONTRACT_VERSION, toServerError } from "./game";
import { asRecord, type RoomRegistry, type Session } from "./rooms";

const MAX_PAYLOAD_BYTES = 4096;
const MAX_COMMANDS_PER_SECOND = 20;

type Handler = (session: Session, payload: Record<string, unknown>) => number;
type AckCallback = (response: unknown) => void;

function isAckCallback(value: unknown): value is AckCallback {
  return typeof value === "function";
}

function tokenOf(socket: Socket): string | null {
  const token: unknown = socket.handshake.auth.sessionToken;
  return typeof token === "string" ? token : null;
}

function readPayload(value: unknown): Record<string, unknown> {
  if (value === undefined) return {};
  if (JSON.stringify(value).length > MAX_PAYLOAD_BYTES) {
    throw new CommandError("INVALID_PAYLOAD", "That request was too large.");
  }
  return asRecord(value);
}

/** Contract §3: a limit per connection, so one noisy tab can't slow a whole room. */
function createRateLimiter(): () => void {
  let windowStart = 0;
  let count = 0;
  return () => {
    const now = Date.now();
    if (now - windowStart >= 1000) {
      windowStart = now;
      count = 0;
    }
    count += 1;
    if (count > MAX_COMMANDS_PER_SECOND) {
      throw new CommandError("RATE_LIMITED", "Slow down a little and try again.");
    }
  };
}

export function attachSockets(io: Server, registry: RoomRegistry): void {
  io.use((socket, next) => {
    const token = tokenOf(socket);
    if (token !== null && registry.sessionForToken(token)) {
      next();
      return;
    }
    next(
      Object.assign(new Error("UNAUTHORIZED"), {
        data: {
          v: CONTRACT_VERSION,
          code: "UNAUTHORIZED",
          message: "Your game session ended.",
        },
      }),
    );
  });

  io.on("connection", (socket) => {
    const token = tokenOf(socket);
    const session = token === null ? undefined : registry.sessionForToken(token);
    if (token === null || !session) {
      socket.disconnect(true);
      return;
    }

    const checkRate = createRateLimiter();

    const on = (name: string, handler: Handler): void => {
      // socket.io passes the ack as the first argument when a client sends no payload.
      socket.on(name, (first: unknown, second: unknown) => {
        const ack = isAckCallback(first) ? first : isAckCallback(second) ? second : null;
        let requestId: string | undefined;
        try {
          const payload = readPayload(isAckCallback(first) ? undefined : first);
          if (typeof payload.requestId === "string") requestId = payload.requestId;
          checkRate();
          // Looked up each time: this session ends when the player leaves the room.
          const current = registry.sessionForToken(token);
          if (!current) throw new CommandError("UNAUTHORIZED", "Your game session ended.");
          const version = handler(current, payload);
          ack?.({ v: CONTRACT_VERSION, ok: true, version, requestId });
        } catch (error) {
          const serverError = toServerError(error, requestId);
          if (ack) {
            ack({ v: CONTRACT_VERSION, ok: false, error: serverError, requestId });
          } else {
            socket.emit("error", { v: CONTRACT_VERSION, ...serverError });
          }
        }
      });
    };

    on("room:addAi", (current, payload) => registry.addAi(current, payload));
    on("room:leave", (current) => {
      void socket.leave(current.roomCode); // first, so they don't hear about their own exit
      return registry.leave(current);
    });
    on("game:start", (current, payload) => registry.start(current, payload));
    on("game:roll", (current) => registry.roll(current));
    on("game:move", (current, payload) => registry.move(current, payload));
    on("game:restart", (current) => registry.restart(current));
    on("state:sync", (current, payload) => registry.sync(current, payload));

    socket.on("disconnect", () => {
      const current = registry.sessionForToken(token);
      if (current) registry.disconnect(current, socket.id);
    });

    void socket.join(session.roomCode);
    registry.connect(session, socket.id);
  });
}
