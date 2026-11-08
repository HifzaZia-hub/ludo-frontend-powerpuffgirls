// Builds the mock without starting it, so tests can run it on a spare port with fast timers.

import { createServer, type Server as HttpServer } from "node:http";
import express, { type ErrorRequestHandler, type RequestHandler } from "express";
import { Server } from "socket.io";
import { debugRouter } from "./debug";
import { CommandError } from "./game";
import { sendError, restRouter } from "./rest";
import { RoomRegistry, type Outbox, type Timing } from "./rooms";
import { attachSockets } from "./sockets";

const DEFAULT_TIMING: Timing = {
  passDelayMs: 1000, // contract §4: the server waits 1s before ending a turn with no move
  absenceMs: 2 * 60 * 1000, // contract §7
};

export interface MockServerOptions {
  debug: boolean;
  timing?: Partial<Timing>;
}

export interface MockServer {
  httpServer: HttpServer;
  io: Server;
}

// Any origin is allowed because this only ever runs on the developer's own machine (index.ts
// binds to loopback), and throwaway test pages can come from any port or from a local file.
const allowAnyOrigin: RequestHandler = (req, res, next) => {
  const { origin } = req.headers;
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  }
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
};

// Express needs all four arguments here to recognise this as an error handler.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const badBodyHandler: ErrorRequestHandler = (_error, _req, res, _next) => {
  sendError(res, new CommandError("INVALID_PAYLOAD", "That request was not in the right format."));
};

export function createMockServer(options: MockServerOptions): MockServer {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: true },
    // Contract §7: a lost connection is noticed within 25 seconds.
    pingInterval: 15000,
    pingTimeout: 10000,
  });

  const outbox: Outbox = {
    toRoom: (roomCode, event, payload) => {
      io.to(roomCode).emit(event, payload);
    },
    toSocket: (socketId, event, payload) => {
      io.to(socketId).emit(event, payload);
    },
    dropSocket: (socketId) => {
      io.sockets.sockets.get(socketId)?.disconnect(true);
    },
    evictRoom: (roomCode) => {
      io.in(roomCode).socketsLeave(roomCode);
    },
  };
  const registry = new RoomRegistry(outbox, { ...DEFAULT_TIMING, ...options.timing });

  app.use(allowAnyOrigin);
  app.use(express.json({ limit: "4kb" }));
  app.use(
    "/api/v1",
    restRouter(registry, () => io.engine.clientsCount),
  );
  if (options.debug) app.use("/debug", debugRouter(registry));
  app.use(badBodyHandler);

  attachSockets(io, registry);
  return { httpServer, io };
}
