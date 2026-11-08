// Entry point for `npm run mock` and `npm run mock:debug`.

import { createMockServer } from "./server";

const PORT = Number(process.env.PORT ?? 3001);
const HOST = "127.0.0.1"; // loopback only: this server has no real security and open CORS

// `--debug` exists because `MOCK_DEBUG=1 npm run mock` doesn't work in Windows shells.
const debug = process.env.MOCK_DEBUG === "1" || process.argv.includes("--debug");

const { httpServer } = createMockServer({ debug });

httpServer.listen(PORT, HOST, () => {
  console.log(`Mock LGS on http://localhost:${PORT} (debug routes ${debug ? "ON" : "off"})`);
});
