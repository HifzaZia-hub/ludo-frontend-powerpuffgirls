// @vitest-environment node
// FR-SYS-04 EXC-04-1 lives in this adapter, so these run it against a real socket server.

import { createServer, type Server as HttpServer } from "node:http";
import type { AddressInfo } from "node:net";
import { Server, type Socket } from "socket.io";
import type { AdapterHandlers, ConnectionStatus } from "@/adapter/GameAdapter";
import { LgsAdapter } from "@/adapter/LgsAdapter";
import type { GameStateSnapshot, ServerError } from "@/contract/types";

const SHORT_TIMEOUT_MS = 100;

type RestReply = { status: number; contentType: string; body: string };

let http: HttpServer;
let io: Server;
let url: string;
let adapter: LgsAdapter;
let statuses: ConnectionStatus[];
let handlers: AdapterHandlers;
let restReply: RestReply;

function emptyHandlers(): AdapterHandlers {
  return {
    onRoom: vi.fn(),
    onState: vi.fn(),
    onEvent: vi.fn(),
    onError: vi.fn(),
    onConnection: (status) => statuses.push(status),
    onSessionReplaced: vi.fn(),
  };
}

function connected(): Promise<Socket> {
  return new Promise((resolve) => {
    io.once("connection", resolve);
    adapter.connect("test-token");
  });
}

beforeEach(async () => {
  restReply = { status: 200, contentType: "application/json", body: "{}" };
  http = createServer((_request, response) => {
    response.writeHead(restReply.status, { "Content-Type": restReply.contentType });
    response.end(restReply.body);
  });
  io = new Server(http);
  await new Promise<void>((resolve) => http.listen(0, "127.0.0.1", resolve));
  url = `http://127.0.0.1:${(http.address() as AddressInfo).port}`;

  statuses = [];
  handlers = emptyHandlers();
  adapter = new LgsAdapter(url, SHORT_TIMEOUT_MS);
  adapter.on(handlers);
});

afterEach(async () => {
  adapter.disconnect();
  await io.close();
});

describe("commands", () => {
  it("attaches a uuid requestId to a roll and passes on the ack", async () => {
    let received: { requestId?: string } = {};
    const socket = await connected();
    socket.on("game:roll", (payload: { requestId: string }, ack: (reply: unknown) => void) => {
      received = payload;
      ack({ ok: true, version: 3, requestId: payload.requestId });
    });

    await expect(adapter.roll()).resolves.toEqual({ ok: true, version: 3 });
    expect(received.requestId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("accepts an ack with no requestId, because the Ack type doesn't promise one", async () => {
    const socket = await connected();
    socket.on("game:move", (_payload: unknown, ack: (reply: unknown) => void) => {
      ack({ ok: true, version: 4 });
    });

    await expect(adapter.move("R1")).resolves.toEqual({ ok: true, version: 4 });
  });

  it("passes on a rejection unchanged", async () => {
    const error: ServerError = { code: "ILLEGAL_MOVE", message: "Needs a 6." };
    const socket = await connected();
    socket.on("game:move", (_payload: unknown, ack: (reply: unknown) => void) => {
      ack({ ok: false, error });
    });

    await expect(adapter.move("R1")).resolves.toEqual({ ok: false, error });
  });

  // FR-SYS-04 EXC-04-1
  it("resolves to INTERNAL_ERROR when the server never answers", async () => {
    const socket = await connected();
    socket.on("game:roll", () => undefined);

    const ack = await adapter.roll();

    expect(ack.ok).toBe(false);
    expect(!ack.ok && ack.error.code).toBe("INTERNAL_ERROR");
  });

  it("resolves to INTERNAL_ERROR when an ack answers some other request", async () => {
    const socket = await connected();
    socket.on("game:roll", (_payload: unknown, ack: (reply: unknown) => void) => {
      ack({ ok: true, version: 9, requestId: "someone-elses" });
    });

    const ack = await adapter.roll();

    expect(!ack.ok && ack.error.code).toBe("INTERNAL_ERROR");
  });

  // FR-SYS-04 EXC-04-1: don't guess.
  it("resolves to INTERNAL_ERROR on an incomplete ack", async () => {
    const socket = await connected();
    socket.on("game:roll", (_payload: unknown, ack: (reply: unknown) => void) => {
      ack({ ok: true });
    });

    const ack = await adapter.roll();

    expect(!ack.ok && ack.error.code).toBe("INTERNAL_ERROR");
  });

  // Contract §8: before a match exists there is no state version to send.
  it.each([
    ["no version", { ok: true }],
    ["a null version", { ok: true, version: null }],
  ])("accepts a lobby ack with %s", async (_name, reply) => {
    const socket = await connected();
    socket.on("room:addAi", (_payload: unknown, ack: (reply: unknown) => void) => {
      ack(reply);
    });

    await expect(adapter.addAi(2, "EASY")).resolves.toEqual({ ok: true, version: 0 });
  });

  it("fails straight away when there is no connection", async () => {
    const ack = await adapter.roll();
    expect(!ack.ok && ack.error.code).toBe("INTERNAL_ERROR");
  });
});

describe("REST calls", () => {
  const request = { displayName: "Maryam", mode: "HUMAN_VS_AI", seats: 2 } as const;

  it("returns the data on success", async () => {
    restReply.body = JSON.stringify({ roomCode: "K7QX2M" });
    const result = await adapter.createRoom(request);
    expect(result.ok && result.data.roomCode).toBe("K7QX2M");
  });

  it("passes on a ServerError body", async () => {
    restReply = {
      status: 400,
      contentType: "application/json",
      body: JSON.stringify({ code: "INVALID_NAME", message: "Bad name." }),
    };
    const result = await adapter.createRoom(request);
    expect(!result.ok && result.error.code).toBe("INVALID_NAME");
  });

  it("does not throw on an HTML error page", async () => {
    restReply = { status: 502, contentType: "text/html", body: "<h1>Bad gateway</h1>" };
    const result = await adapter.createRoom(request);
    expect(!result.ok && result.error).toEqual({
      code: "INTERNAL_ERROR",
      message: "Could not reach the server.",
    });
  });

  it("does not throw when the server is down", async () => {
    await io.close();
    const result = await adapter.createRoom(request);
    expect(!result.ok && result.error.message).toBe("Could not reach the server.");
  });
});

describe("incoming messages", () => {
  it("reports connecting then live", async () => {
    await connected();
    await vi.waitFor(() => expect(statuses).toEqual(["connecting", "live"]));
  });

  it("takes the snapshot out of game:state", async () => {
    const snapshot = { version: 7 } as GameStateSnapshot;
    const socket = await connected();

    socket.emit("game:state", { v: "1.0.0", version: 7, snapshot });

    await vi.waitFor(() => expect(handlers.onState).toHaveBeenCalledWith(snapshot));
  });

  // FR-SYS-04 EXC-04-1
  it("ignores a game:state with no snapshot", async () => {
    const socket = await connected();

    socket.emit("game:state", { v: "1.0.0", version: 7 });
    socket.emit("game:event", { v: "1.0.0", version: 7, type: "ROLLED", data: {} });

    await vi.waitFor(() => expect(handlers.onEvent).toHaveBeenCalled());
    expect(handlers.onState).not.toHaveBeenCalled();
  });

  it("reports reconnecting, then live again, after the connection drops", async () => {
    const socket = await connected();
    await vi.waitFor(() => expect(statuses).toContain("live"));

    socket.conn.close();

    await vi.waitFor(() => expect(statuses).toContain("reconnecting"));
    await vi.waitFor(() => expect(statuses.slice(-1)).toEqual(["live"]), { timeout: 5000 });
  });

  it("reports lost and the error when the server refuses the session", async () => {
    const refusal: ServerError = { code: "UNAUTHORIZED", message: "Your game session ended." };
    io.use((_socket, next) => {
      next(Object.assign(new Error("UNAUTHORIZED"), { data: refusal }));
    });

    adapter.connect("bad-token");

    await vi.waitFor(() => expect(statuses).toEqual(["connecting", "lost"]));
    expect(handlers.onError).toHaveBeenCalledWith(refusal);
  });

  it("stops for good when another tab takes the session", async () => {
    const socket = await connected();
    await vi.waitFor(() => expect(statuses).toContain("live"));

    socket.emit("session:replaced");

    await vi.waitFor(() => expect(handlers.onSessionReplaced).toHaveBeenCalled());
    expect(statuses).not.toContain("reconnecting");
    const ack = await adapter.roll();
    expect(!ack.ok && ack.error.code).toBe("INTERNAL_ERROR");
  });

  it("says nothing about the connection when we leave on purpose", async () => {
    await connected();
    await vi.waitFor(() => expect(statuses).toContain("live"));

    adapter.disconnect();

    expect(statuses).toEqual(["connecting", "live"]);
  });
});
