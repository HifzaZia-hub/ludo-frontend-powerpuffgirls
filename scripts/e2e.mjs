// End-to-end checks for P12 (NFR-SYS-01 to NFR-SYS-10), run against the mock server in a real
// Chrome or Edge. It uses only Node's built-ins and the DevTools Protocol, so it adds no library.
//
//   npm run e2e -- <mode> [--browser chrome|edge] [--count 5] [--fast] [--build] [--save] [--headed]
//
// Modes
//   keyboard   a whole game with no mouse: setup, lobby, roll, choose, move, restart, leave (NFR-SYS-08)
//   games      --count full games against the computer, one after another (NFR-SYS-02, NFR-SYS-03)
//   sizes      main, setup, lobby and game screens at three window sizes (NFR-SYS-10)
//   grayscale  game and win screens with colour vision turned off, in both themes (NFR-SYS-07)
//   contrast   the contrast of every piece of text on every screen, in both themes
//   perf       time from pressing Roll or Move to the next frame drawn (NFR-SYS-01)
//   invalid    fast repeated presses, and presses for moves that aren't on offer (NFR-SYS-04)
//   boundary   the dev-only broken fixture shows the error screen (NFR-SYS-03)
//   smoke      start, roll, move and win (NFR-SYS-09)
//
// Flags
//   --fast     the computer waits 30 ms instead of the default, through the mock's debug route
//   --build    serve the production build instead of the dev server (no dev-only checks)
//   --save     write screenshots into docs/evidence instead of a temporary folder (the perf
//              trace always goes to a temporary folder; open it in DevTools → Performance)
//   --headed   show the browser window
//
// It starts its own mock (port 3101), app (5198) and browser (9333) and stops them at the end, so
// it never touches `npm run mock` or `npm run dev`. It needs Node 22 or later, for WebSocket.

import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MOCK_PORT = 3101;
const APP_PORT = 5198;
const DEBUG_PORT = 9333;
const MOCK = `http://localhost:${MOCK_PORT}`;
const APP = `http://localhost:${APP_PORT}`;
const FAST_RULES = { aiDelayMs: 30, turnTimerSeconds: 0 };
const TIMING_TAG = "[NFR-SYS-02]"; // src/feedback/aiTimings.ts
const SIZES = [
  [1024, 768],
  [1366, 768],
  [1920, 1080],
];

// ---------------------------------------------------------------------------------------------
// Command line

const VALUE_FLAGS = new Set(["browser", "count"]);
const positional = [];
const flags = new Map();
{
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg.startsWith("--")) {
      positional.push(arg);
      continue;
    }
    const name = arg.slice(2);
    if (VALUE_FLAGS.has(name)) flags.set(name, args[++i]);
    else flags.set(name, true);
  }
}
const mode = positional[0] ?? "smoke";
const browserName = flags.get("browser") ?? "chrome";
const count = Number(flags.get("count") ?? 5);
const fast = flags.has("fast");
const build = flags.has("build");
const headed = flags.has("headed");
const OUT = flags.has("save")
  ? path.join(ROOT, "docs/evidence")
  : mkdtempSync(path.join(os.tmpdir(), "ludo-e2e-"));

const BROWSERS = {
  chrome: [
    process.env.CHROME_PATH,
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    process.env.LOCALAPPDATA && `${process.env.LOCALAPPDATA}/Google/Chrome/Application/chrome.exe`,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
  ],
  edge: [
    process.env.EDGE_PATH,
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/usr/bin/microsoft-edge",
  ],
};

// ---------------------------------------------------------------------------------------------
// Small helpers

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const problems = [];
function problem(text) {
  problems.push(text);
  console.log(`PROBLEM: ${text}`);
}
function check(what, ok, detail = "") {
  console.log(`${ok ? "ok  " : "FAIL"} ${what}${detail ? ` (${detail})` : ""}`);
  if (!ok) problems.push(what);
  return ok;
}

async function waitFor(url, label, tries = 240) {
  for (let i = 0; i < tries; i++) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
    } catch {
      // not up yet
    }
    await sleep(250);
  }
  throw new Error(`${label} did not start`);
}

async function ensureFree(port, label) {
  try {
    await fetch(`http://localhost:${port}/`, { signal: AbortSignal.timeout(800) });
  } catch {
    return;
  }
  throw new Error(`port ${port} (${label}) is already in use. Stop whatever is using it first.`);
}

async function debugPost(route, body) {
  const response = await fetch(`${MOCK}/debug/${route}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`debug/${route} ${response.status}: ${await response.text()}`);
  return response.json();
}

// ---------------------------------------------------------------------------------------------
// Processes

const children = [];
function startNode(args, env = {}) {
  const child = spawn(process.execPath, args, {
    cwd: ROOT,
    stdio: "ignore",
    env: { ...process.env, ...env },
  });
  children.push(child);
  return child;
}
function stop(child) {
  if (!child.pid || child.exitCode !== null) return;
  if (process.platform === "win32") {
    const taskkill = path.join(process.env.SystemRoot ?? "C:\\Windows", "System32", "taskkill.exe");
    try {
      execFileSync(taskkill, ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    } catch {
      // already gone
    }
  } else {
    child.kill("SIGTERM");
  }
}

// ---------------------------------------------------------------------------------------------
// DevTools Protocol

async function connect() {
  const response = await waitFor(`http://127.0.0.1:${DEBUG_PORT}/json/version`, "the browser");
  const { webSocketDebuggerUrl } = await response.json();
  const socket = new WebSocket(webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  let nextId = 1;
  const waiting = new Map();
  const listeners = new Map();
  socket.addEventListener("message", ({ data }) => {
    const message = JSON.parse(data);
    if (message.id !== undefined) {
      const entry = waiting.get(message.id);
      if (!entry) return;
      waiting.delete(message.id);
      if (message.error) entry.reject(new Error(`${entry.method}: ${message.error.message}`));
      else entry.resolve(message.result);
      return;
    }
    listeners.get(message.sessionId ?? "")?.(message);
  });
  // If the browser stops answering, fail with the call's name instead of waiting forever.
  socket.addEventListener("close", () => {
    for (const { reject, method } of waiting.values()) reject(new Error(`${method}: the browser went away`));
    waiting.clear();
  });
  const send = (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      const timer = setTimeout(() => {
        waiting.delete(id);
        reject(new Error(`${method}: no answer from the browser in 60 s`));
      }, 60000);
      const settle = (fn) => (value) => {
        clearTimeout(timer);
        fn(value);
      };
      waiting.set(id, { resolve: settle(resolve), reject: settle(reject), method });
      socket.send(JSON.stringify({ id, method, params, sessionId }));
    });
  return { send, listeners, close: () => socket.close() };
}

const KEYS = {
  Enter: { key: "Enter", code: "Enter", keyCode: 13, text: "\r" },
  Tab: { key: "Tab", code: "Tab", keyCode: 9 },
  Escape: { key: "Escape", code: "Escape", keyCode: 27 },
  Space: { key: " ", code: "Space", keyCode: 32, text: " " },
  ArrowLeft: { key: "ArrowLeft", code: "ArrowLeft", keyCode: 37 },
  ArrowUp: { key: "ArrowUp", code: "ArrowUp", keyCode: 38 },
  ArrowRight: { key: "ArrowRight", code: "ArrowRight", keyCode: 39 },
  ArrowDown: { key: "ArrowDown", code: "ArrowDown", keyCode: 40 },
  r: { key: "r", code: "KeyR", keyCode: 82, text: "r" },
};
for (const digit of "123456789") {
  KEYS[digit] = { key: digit, code: `Digit${digit}`, keyCode: 48 + Number(digit), text: digit };
}

async function openPage(cdp, width = 1280, height = 720) {
  const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
  const call = (method, params) => cdp.send(method, params, sessionId);
  const page = { errors: [], logs: [], traceEvents: [], traceDone: null, call };

  cdp.listeners.set(sessionId, ({ method, params }) => {
    if (method === "Runtime.consoleAPICalled") {
      const text = params.args.map((arg) => arg.value ?? arg.description ?? "").join(" ");
      (params.type === "error" ? page.errors : page.logs).push(text);
    } else if (method === "Runtime.exceptionThrown") {
      const details = params.exceptionDetails;
      page.errors.push(details.exception?.description ?? details.text);
    } else if (method === "Tracing.dataCollected") {
      page.traceEvents.push(...params.value);
    } else if (method === "Tracing.tracingComplete") {
      page.traceDone?.();
    }
  });
  await call("Page.enable");
  await call("Runtime.enable");
  await call("Emulation.setFocusEmulationEnabled", { enabled: true });

  page.evaluate = async (expression) => {
    const { result, exceptionDetails } = await call("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (exceptionDetails) {
      throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
    }
    return result.value;
  };
  page.waitUntil = async (expression, label, ms = 30000) => {
    const until = Date.now() + ms;
    while (Date.now() < until) {
      if (await page.evaluate(expression)) return;
      await sleep(60);
    }
    // Leave something to look at: what the page said, and a picture of it.
    const text = await page.evaluate(`document.body.innerText.replace(/\\s+/g, ' ').slice(0, 300)`);
    const picture = await page.shot(`timeout-${label.replace(/[^a-z0-9]+/gi, "-")}.png`);
    throw new Error(`timed out waiting for ${label}. The page said: "${text}". Screenshot: ${picture}`);
  };
  page.goto = async (url, ready) => {
    await call("Page.navigate", { url });
    await page.waitUntil(ready, url);
    await sleep(300);
  };
  page.size = (w, h) =>
    call("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: false });
  page.shot = async (name) => {
    // A tab in the background draws no frames, so capturing it can wait forever.
    await call("Page.bringToFront");
    const captured = await Promise.race([
      call("Page.captureScreenshot", { format: "png" }),
      sleep(15000).then(() => null),
    ]);
    if (!captured) {
      problem(`screenshot timed out: ${name}`);
      return null;
    }
    const file = path.join(OUT, name);
    writeFileSync(file, Buffer.from(captured.data, "base64"));
    return file;
  };
  page.press = async (name, { shift = false, pause = 120 } = {}) => {
    const { key, code, keyCode, text } = KEYS[name];
    const common = { key, code, windowsVirtualKeyCode: keyCode, modifiers: shift ? 8 : 0 };
    await call("Input.dispatchKeyEvent", { type: "keyDown", ...common, ...(text ? { text } : {}) });
    await call("Input.dispatchKeyEvent", { type: "keyUp", ...common });
    if (pause) await sleep(pause);
  };
  page.type = async (text) => {
    for (const char of text) await call("Input.dispatchKeyEvent", { type: "char", text: char });
    await sleep(100);
  };
  page.click = async (x, y, pause = 200) => {
    const event = { x, y, button: "left", clickCount: 1 };
    await call("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
    await call("Input.dispatchMouseEvent", { type: "mousePressed", ...event });
    await call("Input.dispatchMouseEvent", { type: "mouseReleased", ...event });
    if (pause) await sleep(pause);
  };
  page.centreOf = (expression) =>
    page.evaluate(`(() => {
      const el = ${expression};
      if (!el) return null;
      el.scrollIntoView({ block: 'center', inline: 'center' });
      const r = el.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    })()`);
  page.clickButton = async (name, scope = "document") => {
    const centre = await page.centreOf(`(() => {
      const buttons = [...${scope}.querySelectorAll('button')].filter((b) => b.getClientRects().length > 0);
      const label = (b) => (b.getAttribute('aria-label') || b.textContent).trim();
      return buttons.find((b) => label(b) === ${JSON.stringify(name)}) ?? buttons.find((b) => label(b).includes(${JSON.stringify(name)}));
    })()`);
    if (!centre) throw new Error(`no button named ${name}`);
    await page.click(centre.x, centre.y);
  };
  page.close = () => cdp.send("Target.closeTarget", { targetId });

  await page.size(width, height);
  return page;
}

// ---------------------------------------------------------------------------------------------
// What the page shows

const DIE = `document.querySelector('button[aria-label*="ice"]')`;
const LIST = `document.querySelector('section[aria-label="Your moves"]')`;
const CAN_ROLL = `(() => { const d = ${DIE}; return !!d && !d.hasAttribute('aria-disabled') && !d.hasAttribute('aria-busy'); })()`;
const OPTIONS_OPEN = `(() => { const l = ${LIST}; const b = l?.querySelector('li button'); return !!b && !b.hasAttribute('aria-disabled'); })()`;
const CRASHED = `[...document.querySelectorAll('[role="alert"]')].some((el) => el.textContent.includes('Something went wrong'))`;
const HEADING = `(document.querySelector('h1')?.textContent ?? '')`;
const WON = `${HEADING}.includes('wins')`;
const BUTTON_NAMES = `[...document.querySelectorAll('button')].map((b) => (b.getAttribute('aria-label') || b.textContent).trim())`;
const ON_MAIN = `(${BUTTON_NAMES}).includes('New Game')`;
const IN_LOBBY = `document.body.innerText.includes('Start game')`;
const ON_BOARD = `document.querySelector('[data-piece]') !== null`;
const DIALOG_OPEN = `document.querySelector('dialog[open]') !== null`;
const PIECE_POSITIONS = `JSON.stringify(Object.fromEntries([...document.querySelectorAll('[data-piece]')].map((el) => [el.dataset.piece, el.style.left + ' ' + el.style.top])))`;
const PROGRESS = `[...document.querySelectorAll('section[aria-label="Players"] li')].map((li) => [...li.querySelectorAll('dd')].map((d) => d.textContent).join('/'))`;
const ALL_IN_BASE = `(() => { const p = ${PROGRESS}; return p.length > 0 && p.every((x) => x === '4/0/0'); })()`;
const STATE = `(() => {
  const list = ${LIST};
  const turn = document.querySelector('header p');
  return {
    crashed: ${CRASHED},
    finished: ${WON},
    canRoll: ${CAN_ROLL},
    open: ${OPTIONS_OPEN},
    options: list ? [...list.querySelectorAll('li button')].map((b) => b.textContent.replace('✓', '').trim()) : [],
    movable: [...document.querySelectorAll('[data-piece] button')].map((b) => b.closest('[data-piece]').dataset.piece),
    pressed: document.querySelector('[data-piece] button[aria-pressed="true"]')?.closest('[data-piece]').dataset.piece ?? null,
    turn: turn ? turn.innerText.replace(/\\s+/g, ' ').trim() : null,
  };
})()`;
const ACTIVE = `(() => {
  const a = document.activeElement;
  if (!a || a === document.body) return { tag: 'BODY', name: '', role: null, checked: null, piece: null, card: false, pressed: null, inDialog: false };
  return {
    tag: a.tagName,
    name: (a.getAttribute('aria-label') || a.textContent || '').trim(),
    role: a.getAttribute('role'),
    checked: a.getAttribute('aria-checked'),
    piece: a.closest('[data-piece]')?.dataset.piece ?? null,
    card: !!a.closest('section[aria-label="Your moves"]') && a.tagName === 'BUTTON' && a.textContent.trim() !== 'Move',
    pressed: a.getAttribute('aria-pressed'),
    inDialog: !!a.closest('dialog[open]'),
  };
})()`;
const WIN_PAGE = `(() => {
  const places = document.querySelector('section[aria-label="Final places"]');
  return {
    heading: ${HEADING},
    places: places ? [...places.querySelectorAll('li')].map((li) => li.textContent.trim()) : null,
    playAgain: (${BUTTON_NAMES}).includes('Play again'),
  };
})()`;
// The game screen's parts, and whether each is fully inside the window (FR-SYS-09, NFR-SYS-10).
const GAME_LAYOUT = `(() => {
  const de = document.documentElement;
  const parts = { topBar: 'header', board: 'section[aria-label="Game board"] > div', players: 'section[aria-label="Players"]', dice: 'button[aria-label*="ice"]', messages: 'section[aria-label="Messages"]', moves: 'section[aria-label="Your moves"]' };
  const out = { sideways: de.scrollWidth > de.clientWidth, taller: de.scrollHeight > de.clientHeight, hidden: [] };
  for (const [name, selector] of Object.entries(parts)) {
    const el = document.querySelector(selector);
    const r = el?.getBoundingClientRect();
    if (!r || r.left < 0 || r.top < 0 || r.right > innerWidth + 0.5 || r.bottom > innerHeight + 0.5) out.hidden.push(name);
  }
  return out;
})()`;
// Any screen: does the page scroll, and which controls are outside the window?
const PAGE_LAYOUT = `(() => {
  const de = document.documentElement;
  const controls = [...document.querySelectorAll('button, input, a[href]')].filter((el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden');
  const outside = controls.filter((el) => { const r = el.getBoundingClientRect(); return r.left < 0 || r.top < 0 || r.right > innerWidth + 0.5 || r.bottom > innerHeight + 0.5; });
  return { sideways: de.scrollWidth > de.clientWidth, taller: de.scrollHeight > de.clientHeight, controls: controls.length, outOfView: outside.map((el) => (el.getAttribute('aria-label') || el.value || el.textContent || el.tagName).trim().slice(0, 30)) };
})()`;

// ---------------------------------------------------------------------------------------------
// Getting around

async function mainScreen(page) {
  await page.goto(APP, ON_MAIN);
}

async function setTheme(page, label) {
  await page.clickButton("Settings");
  await page.waitUntil(DIALOG_OPEN, "the settings");
  await page.evaluate(`[...document.querySelectorAll('dialog[open] [role="radio"]')].find((b) => b.textContent.trim() === '${label}').click()`);
  await page.press("Escape");
  await sleep(250);
}

// Only the room code leaves the page. The session token stays in it (CLAUDE.md §4).
const ROOM_CODE = `JSON.parse(sessionStorage.getItem('ludo-session') ?? 'null')?.roomCode ?? null`;

async function setUp(page, type, name = "Rida") {
  await page.clickButton("New Game");
  await page.waitUntil(`document.querySelector('input') !== null`, "the setup screen");
  await page.clickButton(type);
  await page.evaluate(`document.querySelector('input').focus()`);
  await page.type(name);
  await page.clickButton("Start");
}

/** A game against the computer. The mock starts it at once, with no waiting room. */
async function computerGame(page, rules = fast ? FAST_RULES : null) {
  await mainScreen(page);
  await setUp(page, "Play with computer");
  await page.waitUntil(ON_BOARD, "the board");
  const code = await page.evaluate(ROOM_CODE);
  if (rules) {
    // The mock's rules route changes the next match, so start a new one to use them.
    await debugPost("rules", { roomCode: code, ...rules });
    await page.clickButton("Menu");
    await page.clickButton("Restart");
    await page.waitUntil(DIALOG_OPEN, "the restart question");
    await page.clickButton("Restart", "document.querySelector('dialog[open]')");
    await page.waitUntil(`!${DIALOG_OPEN} && ${ALL_IN_BASE}`, "the restarted match");
  }
  await sleep(400);
  return code;
}

/** The waiting room of a game with friends, whose empty seats will get computer players. */
async function hostLobby(page) {
  await mainScreen(page);
  await setUp(page, "Play with friends");
  await page.waitUntil(IN_LOBBY, "the waiting room");
  return page.evaluate(ROOM_CODE);
}

async function startHosted(page, code, rules = FAST_RULES) {
  await debugPost("rules", { roomCode: code, ...rules });
  await page.clickButton("Fill empty seats");
  await page.clickButton("Start game");
  await page.waitUntil(ON_BOARD, "the board");
  await sleep(400);
}

const pieceNumber = (option) => option.match(/Piece (\d)/)?.[1] ?? null;

async function tabUntil(page, test, label, { back = false, limit = 80 } = {}) {
  for (let i = 0; i < limit; i++) {
    await page.press("Tab", { shift: back });
    const active = await page.evaluate(ACTIVE);
    if (test(active)) return active;
  }
  throw new Error(`Tab never reached ${label}`);
}

async function clickCardThenMove(page) {
  const card = await page.centreOf(`${LIST}.querySelector('li button')`);
  await page.click(card.x, card.y);
  await page.clickButton("Move");
}

/** Plays my turns until the match ends, or until `stopAfter` moves. */
async function play(page, { label, keyboardOnly = false, stopAfter = Infinity }) {
  const started = Date.now();
  const stats = { rolls: 0, moves: 0, oddPresses: 0 };
  for (;;) {
    const state = await page.evaluate(STATE);
    if (state.crashed) throw new Error(`${label}: the error screen appeared`);
    if (state.finished || stats.moves >= stopAfter) break;
    // At the default speed a four-player game can take a quarter of an hour.
    const minutes = (Date.now() - started) / 60000;
    if (minutes > 40) throw new Error(`${label}: no winner after 40 minutes. ${JSON.stringify(stats)}`);
    if (stats.rolls > 0 && stats.rolls % 50 === 0 && state.canRoll) {
      console.log(`${label}: ${stats.rolls} rolls, ${stats.moves} moves, ${Math.round(minutes * 60)} s`);
    }
    if (state.canRoll) {
      if (keyboardOnly || stats.rolls % 2 === 0) await page.press("r");
      else {
        const die = await page.centreOf(DIE);
        await page.click(die.x, die.y);
      }
      stats.rolls += 1;
      continue;
    }
    if (state.open) {
      const way = stats.moves % 3;
      if (keyboardOnly && way === 1) {
        const active = await tabUntil(page, ({ piece }) => piece !== null, "a piece", { back: true });
        if ((await page.evaluate(STATE)).pressed !== active.piece) stats.oddPresses += 1;
        await page.press("Enter");
      } else if (keyboardOnly && way === 2) {
        const active = await tabUntil(page, ({ card }) => card, "a card");
        if (active.pressed !== "true") stats.oddPresses += 1;
        await page.press("Enter");
      } else if (!keyboardOnly && way === 2) {
        await clickCardThenMove(page);
      } else {
        await page.press(pieceNumber(state.options[0]));
        if (!(await page.evaluate(STATE)).pressed) stats.oddPresses += 1;
        await page.press("Enter");
      }
      stats.moves += 1;
      continue;
    }
    await sleep(25);
  }
  stats.seconds = Math.round((Date.now() - started) / 1000);
  return stats;
}

/** Puts my next move one roll from winning, then plays it. */
async function winNow(page, code) {
  await page.waitUntil(CAN_ROLL, "my roll", 60000);
  await debugPost("scenario", { roomCode: code, name: "near-win" });
  await sleep(300);
  await page.press("r");
  await page.waitUntil(OPTIONS_OPEN, "the winning move");
  const { options } = await page.evaluate(STATE);
  await page.press(pieceNumber(options[0]));
  await page.press("Enter");
  await page.waitUntil(WON, "the win screen", 30000);
  await sleep(1200);
}

function reportErrors(page, label, allowed = 0) {
  check(`${label}: no console errors`, page.errors.length <= allowed, page.errors.slice(0, 3).join(" | "));
}

// ---------------------------------------------------------------------------------------------
// Modes

async function keyboard(browser) {
  const page = await browser.page();
  await mainScreen(page);
  await tabUntil(page, ({ name }) => name.includes("New Game"), "New Game");
  await page.press("Enter");
  await page.waitUntil(`document.querySelector('input') !== null`, "the setup screen");
  // A game with friends, because only that has a waiting room. Its empty seats get computers.
  const GAME_TYPES = ["Play with friends", "Play with computer"];
  let type = await tabUntil(page, (a) => a.role === "radio" && GAME_TYPES.includes(a.name), "the game type");
  for (let i = 0; i < 2 && !(type.name === GAME_TYPES[0] && type.checked === "true"); i++) {
    await page.press("ArrowLeft");
    type = await page.evaluate(ACTIVE);
  }
  check("setup: the arrow keys choose the game type", type.name === GAME_TYPES[0] && type.checked === "true");
  await tabUntil(page, ({ tag }) => tag === "INPUT", "the name field");
  await page.type("Rida");
  await tabUntil(page, ({ tag, name }) => tag === "BUTTON" && name === "Start", "Start");
  await page.press("Enter");
  await page.waitUntil(IN_LOBBY, "the waiting room");
  const code = await page.evaluate(ROOM_CODE);
  check("lobby reached by keyboard", code !== null);
  if (fast) await debugPost("rules", { roomCode: code, ...FAST_RULES });
  const fill = await tabUntil(page, ({ name }) => name.includes("Fill empty seats"), "Fill empty seats");
  await page.press("Space");
  const filled = await page.evaluate(ACTIVE);
  check("Space turns on Fill empty seats", filled.checked !== fill.checked, `${fill.checked} → ${filled.checked}`);
  await tabUntil(page, ({ name }) => name.includes("Start game"), "Start game");
  await page.press("Enter");
  await page.waitUntil(ON_BOARD, "the board");
  await sleep(400);

  const early = await play(page, { label: "keyboard", keyboardOnly: true, stopAfter: 3 });
  check("roll, choose and move by keyboard", early.moves === 3, JSON.stringify(early));

  await menuItem(page, "Restart");
  const restartFocus = await page.evaluate(ACTIVE);
  check("the restart question starts on Cancel", restartFocus.name === "Cancel" && restartFocus.inDialog);
  await tabUntil(page, ({ name, inDialog }) => inDialog && name === "Restart", "the Restart button");
  await page.press("Enter");
  await page.waitUntil(ALL_IN_BASE, "the new match", 15000);
  check("restart by keyboard starts a new match", true);

  const game = await play(page, { label: "keyboard", keyboardOnly: true });
  const win = await page.evaluate(WIN_PAGE);
  check("a whole game by keyboard ends on the win screen", win.heading.includes("wins"), `${JSON.stringify(game)} ${win.heading}`);
  await tabUntil(page, ({ name }) => name === "Play again", "Play again");
  await page.press("Enter");
  await page.waitUntil(`${ALL_IN_BASE} && !${WON}`, "the next match", 15000);
  check("Play again by keyboard", true);

  await menuItem(page, "Leave game");
  const leaveFocus = await page.evaluate(ACTIVE);
  check("the leave question starts on Cancel", leaveFocus.name === "Cancel" && leaveFocus.inDialog);
  await page.press("Enter");
  await sleep(400);
  check("Cancel keeps the game", !(await page.evaluate(DIALOG_OPEN)) && (await page.evaluate(ON_BOARD)));
  await menuItem(page, "Leave game");
  await tabUntil(page, ({ name, inDialog }) => inDialog && name === "Leave", "the Leave button");
  await page.press("Enter");
  await page.waitUntil(ON_MAIN, "the main screen", 15000);
  check("leave by keyboard goes back to the main screen", true);
  console.log("the driver sent no mouse events in this mode");
  reportErrors(page, "keyboard");
  await page.close();
}

async function menuItem(page, item) {
  await tabUntil(page, ({ tag, name }) => tag === "BUTTON" && name.includes("Menu"), "Menu");
  await page.press("Enter");
  await tabUntil(page, ({ name }) => name === item, item);
  await page.press("Enter");
  await page.waitUntil(DIALOG_OPEN, `the question after ${item}`);
}

async function games(browser) {
  const page = await browser.page();
  await computerGame(page);
  const results = [];
  for (let i = 1; i <= count; i++) {
    const stats = await play(page, { label: `game ${i}` });
    const win = await page.evaluate(WIN_PAGE);
    results.push({ game: i, ...stats, winner: win.heading });
    console.log(`game ${i}: ${win.heading} in ${stats.seconds} s, ${stats.rolls} rolls, ${stats.moves} moves`);
    if (i < count) {
      await page.clickButton("Play again");
      await page.waitUntil(`${ALL_IN_BASE} && !${WON}`, "the next match", 15000);
    }
  }
  const games = count === 1 ? "1 game" : `${count} games in a row`;
  check(`${games} reached a winner with no error screen`, results.length === count);
  reportErrors(page, "games");

  const timings = page.logs
    .filter((line) => line.startsWith(TIMING_TAG))
    .map((line) => Number(line.match(/took (\d+) ms/)?.[1]))
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  if (timings.length > 0) {
    const median = timings[Math.floor(timings.length / 2)];
    const over = timings.filter((ms) => ms > 2000).length;
    console.log(`computer turns: ${timings.length}, fastest ${timings[0]} ms, median ${median} ms, slowest ${timings.at(-1)} ms, over 2 s: ${over}`);
    check("every computer turn took 2 s or less", over === 0);
  } else if (!build) {
    problem("no computer turn timings were logged");
  }
  await page.close();
}

async function sizes(browser) {
  const page = await browser.page();
  const record = async (screen, layout = PAGE_LAYOUT) => {
    for (const [w, h] of SIZES) {
      await page.size(w, h);
      await sleep(350);
      const result = await page.evaluate(layout);
      const hidden = result.hidden ?? result.outOfView;
      console.log(`${screen} ${w}x${h}: sideways scroll ${result.sideways}, taller than the window ${result.taller}, out of view: ${hidden.length ? hidden.join(", ") : "nothing"}`);
      check(`${screen} at ${w}x${h} has no sideways scroll and nothing out of view`, !result.sideways && hidden.length === 0);
      await page.shot(`NFR-SYS-10-${screen}-${w}x${h}.png`);
    }
  };
  await mainScreen(page);
  await record("main");
  await page.clickButton("New Game");
  await page.waitUntil(`document.querySelector('input') !== null`, "the setup screen");
  await record("setup");
  await page.size(1280, 720);
  const code = await hostLobby(page);
  await record("lobby");
  await page.size(1280, 720);
  await startHosted(page, code);
  await page.waitUntil(CAN_ROLL, "my roll");
  // Two turns in, so the log and the list of moves have something in them.
  await play(page, { label: "sizes", stopAfter: 2 });
  for (;;) {
    await page.waitUntil(`${CAN_ROLL} || ${OPTIONS_OPEN}`, "my turn", 60000);
    if (await page.evaluate(OPTIONS_OPEN)) break;
    await page.press("r");
    await sleep(800);
  }
  await record("game", GAME_LAYOUT);
  reportErrors(page, "sizes");
  await page.close();
}

async function grayscale(browser) {
  const page = await browser.page();
  const code = await computerGame(page, FAST_RULES);
  await play(page, { label: "grayscale", stopAfter: 4 });
  for (;;) {
    await page.waitUntil(`${CAN_ROLL} || ${OPTIONS_OPEN}`, "my turn", 60000);
    if (await page.evaluate(OPTIONS_OPEN)) break;
    await page.press("r");
    await sleep(800);
  }
  await page.call("Emulation.setEmulatedVisionDeficiency", { type: "achromatopsia" });
  await setTheme(page, "Dark");
  await page.shot("NFR-SYS-07-game-dark.png");
  await setTheme(page, "Light");
  await page.shot("NFR-SYS-07-game-light.png");
  const { options } = await page.evaluate(STATE);
  await page.press(pieceNumber(options[0]));
  await page.press("Enter");
  await winNow(page, code);
  await page.shot("NFR-SYS-07-win-light.png");
  await setTheme(page, "Dark");
  await page.shot("NFR-SYS-07-win-dark.png");
  await page.call("Emulation.setEmulatedVisionDeficiency", { type: "none" });
  check("grayscale screenshots taken", true, OUT);
  reportErrors(page, "grayscale");
  await page.close();
}

// WCAG 2.1 AA: 4.5:1 for normal text, 3:1 for large text. Disabled controls are exempt.
const CONTRAST = `(() => {
  const toRgba = (value) => {
    let m = value.match(/^rgba?\\(([^)]+)\\)$/);
    if (m) { const p = m[1].split(/[\\s,\\/]+/).filter(Boolean).map(parseFloat); return [p[0], p[1], p[2], p[3] ?? 1]; }
    m = value.match(/^color\\(srgb ([^)]+)\\)$/);
    if (m) { const p = m[1].split(/[\\s\\/]+/).filter(Boolean).map(parseFloat); return [p[0] * 255, p[1] * 255, p[2] * 255, p[3] ?? 1]; }
    return null;
  };
  const over = (top, bottom) => {
    const a = top[3] + bottom[3] * (1 - top[3]);
    return [0, 1, 2].map((i) => (top[i] * top[3] + bottom[i] * bottom[3] * (1 - top[3])) / a).concat(a);
  };
  const lum = ([r, g, b]) => {
    const f = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const results = [];
  for (const el of document.querySelectorAll('body *')) {
    const text = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim();
    if (!text || el.getClientRects().length === 0) continue;
    const style = getComputedStyle(el);
    if (style.visibility === 'hidden') continue;
    const chain = [];
    for (let node = el; node; node = node.parentElement) chain.push(node);
    let bg = [255, 255, 255, 1];
    let unknown = false;
    let faded = false;
    for (const node of chain.reverse()) {
      const s = getComputedStyle(node);
      if (s.backgroundImage !== 'none') unknown = true;
      if (parseFloat(s.opacity) < 1) faded = true;
      const colour = toRgba(s.backgroundColor);
      if (colour === null) unknown = true;
      else if (colour[3] > 0) bg = over(colour, bg);
    }
    const fg = toRgba(style.color);
    const size = parseFloat(style.fontSize);
    const large = size >= 24 || (size >= 18.66 && Number(style.fontWeight) >= 700);
    results.push({
      text: text.slice(0, 40),
      ratio: fg ? Math.round(ratio(over(fg, bg), bg) * 100) / 100 : null,
      need: large ? 3 : 4.5,
      disabled: !!el.closest('[disabled], [aria-disabled="true"]'),
      unknown,
      faded,
      fg: style.color,
      bg: 'rgb(' + bg.slice(0, 3).map(Math.round).join(', ') + ')',
    });
  }
  return results;
})()`;

async function contrast(browser) {
  for (const theme of ["Dark", "Light"]) {
    const page = await browser.page();
    const failures = [];
    const unsure = [];
    const closest = [];
    let checked = 0;
    const audit = async (screen) => {
      await sleep(700); // let fades finish
      const results = await page.evaluate(CONTRAST);
      const failed = results.filter((r) => r.ratio !== null && r.ratio < r.need && !r.disabled);
      checked += results.length;
      for (const r of results) if ((r.unknown || r.faded) && !r.disabled) unsure.push({ screen, ...r });
      for (const r of results) if (r.ratio !== null && !r.disabled) closest.push({ screen, ...r, margin: r.ratio / r.need });
      for (const r of failed) failures.push({ screen, ...r });
      console.log(`${theme} ${screen}: ${results.length} texts, ${failed.length} below the target`);
    };
    await mainScreen(page);
    // The checker must catch grey on grey, or a pass would mean nothing.
    const probe = await page.evaluate(`(() => {
      const p = document.createElement('p');
      p.textContent = 'contrast probe';
      p.style.cssText = 'color: rgb(119, 119, 119); background: rgb(136, 136, 136)';
      document.body.append(p);
      const result = (${CONTRAST}).find((r) => r.text === 'contrast probe');
      p.remove();
      return result;
    })()`);
    check(`${theme}: the checker catches a grey-on-grey probe`, probe?.ratio < 1.5, `${probe?.ratio}:1`);
    await setTheme(page, theme);
    await audit("main");
    await page.clickButton("Settings");
    await page.waitUntil(DIALOG_OPEN, "the settings");
    await audit("settings");
    await page.press("Escape");
    await page.clickButton("How to play");
    await page.waitUntil(DIALOG_OPEN, "the rules");
    await audit("how to play");
    await page.press("Escape");
    await page.clickButton("Join Game");
    await page.waitUntil(DIALOG_OPEN, "the join form");
    await audit("join");
    await page.press("Escape");
    await sleep(300);
    await page.clickButton("New Game");
    await page.waitUntil(`document.querySelector('input') !== null`, "the setup screen");
    await audit("setup");
    await page.clickButton("Back");
    await page.waitUntil(ON_MAIN, "the main screen");
    // hostLobby reloads the page, which would bring back the default theme.
    await setUp(page, "Play with friends");
    await page.waitUntil(IN_LOBBY, "the waiting room");
    const code = await page.evaluate(ROOM_CODE);
    await audit("lobby");
    await startHosted(page, code);
    await play(page, { label: "contrast", stopAfter: 2 });
    for (;;) {
      await page.waitUntil(`${CAN_ROLL} || ${OPTIONS_OPEN}`, "my turn", 60000);
      if (await page.evaluate(OPTIONS_OPEN)) break;
      await page.press("r");
      await sleep(800);
    }
    await audit("game, choosing a move");
    await page.clickButton("Menu");
    await sleep(300);
    await audit("game menu");
    await page.clickButton("Restart");
    await page.waitUntil(DIALOG_OPEN, "the restart question");
    await audit("restart question");
    await page.press("Escape");
    await sleep(300);
    await page.clickButton("Rules");
    await page.waitUntil(DIALOG_OPEN, "the rules");
    await audit("rules");
    await page.press("Escape");
    const { options } = await page.evaluate(STATE);
    await page.press(pieceNumber(options[0]));
    await page.press("Enter");
    await winNow(page, code);
    await audit("win");
    console.log(`${theme}: ${checked} texts checked, ${unsure.length} on a gradient or faded background, to check by eye:`);
    for (const u of unsure) console.log(`  ${u.screen}: "${u.text}" about ${u.ratio}:1, ${u.fg} on ${u.bg}`);
    const seen = new Set();
    const lowest = closest
      .sort((a, b) => a.margin - b.margin)
      .filter(({ text }) => !seen.has(text) && seen.add(text))
      .slice(0, 3);
    console.log(`${theme}: closest to the target:`);
    for (const c of lowest) console.log(`  ${c.screen}: "${c.text}" ${c.ratio}:1 (needs ${c.need})`);
    for (const f of failures) {
      console.log(`  ${f.screen}: "${f.text}" ${f.ratio}:1 (needs ${f.need}) ${f.fg} on ${f.bg}${f.unknown || f.faded ? " (approximate)" : ""}`);
    }
    check(`${theme} theme: all text meets the contrast target`, failures.length === 0);
    reportErrors(page, `contrast ${theme}`);
    await page.close();
  }
}

// First DOM change after an input, and the frame that draws it (NFR-SYS-01).
const ARM = `(() => {
  const mark = { input: null, change: null, frame: null };
  window.__mark = mark;
  const onInput = (event) => { if (mark.input === null) mark.input = event.timeStamp; };
  addEventListener('pointerdown', onInput, { capture: true, once: true });
  addEventListener('keydown', onInput, { capture: true, once: true });
  const observer = new MutationObserver(() => {
    if (mark.input === null || mark.change !== null) return;
    mark.change = performance.now();
    requestAnimationFrame(() => { mark.frame = performance.now(); });
    observer.disconnect();
  });
  observer.observe(document.body, { attributes: true, childList: true, characterData: true, subtree: true });
  return true;
})()`;
const READ_MARK = `(() => { const m = window.__mark; return m.input === null || m.frame === null ? null : { toChange: m.change - m.input, toFrame: m.frame - m.input }; })()`;
const EVENT_TIMING = `(() => {
  window.__events = [];
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) if (e.interactionId) window.__events.push({ name: e.name, duration: e.duration });
  }).observe({ type: 'event', durationThreshold: 16 });
  return true;
})()`;

async function perf(browser) {
  const page = await browser.page();
  await computerGame(page, { aiDelayMs: 300, turnTimerSeconds: 0 });
  await page.evaluate(EVENT_TIMING);
  await page.call("Tracing.start", {
    traceConfig: {
      includedCategories: [
        "devtools.timeline",
        "disabled-by-default-devtools.timeline",
        "disabled-by-default-devtools.timeline.frame",
        "toplevel",
        "blink.user_timing",
        "latencyInfo",
      ],
    },
    transferMode: "ReportEvents",
  });
  const samples = { "Roll (mouse)": [], "Roll (R key)": [], "Choose (mouse)": [], "Move (Enter)": [], "Move (mouse)": [] };
  const measure = async (name, act) => {
    await page.evaluate(ARM);
    await act();
    await sleep(400);
    const mark = await page.evaluate(READ_MARK);
    if (mark) samples[name].push(mark);
  };
  // The trace stops once it holds one of each kind of press, so it stays small enough to keep.
  let tracing = true;
  const stopTracing = async () => {
    tracing = false;
    const done = new Promise((resolve) => (page.traceDone = resolve));
    await page.call("Tracing.end");
    await Promise.race([done, sleep(20000)]);
  };
  const enough = (least) => Object.values(samples).every((list) => list.length >= least);
  for (let turn = 0; turn < 80 && !enough(5); turn++) {
    if (tracing && enough(1)) await stopTracing();
    await page.waitUntil(CAN_ROLL, "my roll", 60000);
    if (turn % 2 === 0) {
      const die = await page.centreOf(DIE);
      await measure("Roll (mouse)", () => page.click(die.x, die.y, 0));
    } else {
      await measure("Roll (R key)", () => page.press("r", { pause: 0 }));
    }
    await page.waitUntil(`${OPTIONS_OPEN} || ${CAN_ROLL} || !(${DIE})`, "the roll", 15000).catch(() => {});
    await sleep(300);
    if (!(await page.evaluate(OPTIONS_OPEN))) continue;
    const card = await page.centreOf(`${LIST}.querySelector('li button')`);
    await measure("Choose (mouse)", () => page.click(card.x, card.y, 0));
    if (turn % 2 === 0) {
      await measure("Move (Enter)", () => page.press("Enter", { pause: 0 }));
    } else {
      const move = await page.centreOf(`[...${LIST}.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Move')`);
      await measure("Move (mouse)", () => page.click(move.x, move.y, 0));
    }
  }
  if (tracing) await stopTracing();
  // A few megabytes, so it goes to a temporary folder even with --save, never into the repo.
  const traceFile = path.join(mkdtempSync(path.join(os.tmpdir(), "ludo-e2e-trace-")), "NFR-SYS-01-trace.json.gz");
  writeFileSync(traceFile, gzipSync(JSON.stringify({ traceEvents: page.traceEvents })));

  let worst = 0;
  for (const [name, list] of Object.entries(samples)) {
    if (list.length === 0) continue;
    const frames = list.map(({ toFrame }) => toFrame);
    const max = Math.max(...frames);
    worst = Math.max(worst, max);
    const changes = list.map(({ toChange }) => toChange);
    console.log(`${name}: ${list.length} presses, first change after ${Math.round(Math.min(...changes))}–${Math.round(Math.max(...changes))} ms, next frame after ${Math.round(Math.min(...frames))}–${Math.round(max)} ms`);
  }
  // Event Timing measures from the input to the next paint, and only reports events of 16 ms or more.
  const events = await page.evaluate(`window.__events`);
  const byName = new Map();
  for (const { name, duration } of events) {
    const seen = byName.get(name) ?? { count: 0, max: 0 };
    byName.set(name, { count: seen.count + 1, max: Math.max(seen.max, duration) });
  }
  const summary = [...byName].map(([name, { count, max }]) => `${name} ×${count} (max ${max} ms)`).join(", ");
  console.log(`Event Timing, input to next paint, events of 16 ms or more: ${summary || "none"}`);
  console.log(`trace for the Performance panel: ${traceFile}`);
  check("every press showed a change within 1 s", worst > 0 && worst < 1000, `worst ${Math.round(worst)} ms`);
  reportErrors(page, "perf");
  await page.close();
}

// Counts what the page sends to the server, from both socket.io transports.
const SPY = `(() => {
  window.__sent = [];
  const note = (data) => { if (typeof data !== 'string') return; for (const part of data.split('\\x1e')) { const m = part.match(/^42\\d*\\["([^"]+)"/); if (m) window.__sent.push(m[1]); } };
  const ws = WebSocket.prototype.send;
  WebSocket.prototype.send = function (data) { note(data); return ws.call(this, data); };
  const xhr = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function (body) { note(body); return xhr.call(this, body); };
})()`;

async function invalid(browser) {
  const page = await browser.page();
  await page.call("Page.addScriptToEvaluateOnNewDocument", { source: SPY });
  // The computer is slow on purpose, so there is time to press keys during its turn.
  await computerGame(page, { aiDelayMs: 700, turnTimerSeconds: 0 });
  const sent = (name) => page.evaluate(`window.__sent.filter((n) => n === '${name}').length`);
  const untilChoosing = async () => {
    for (;;) {
      await page.waitUntil(`${CAN_ROLL} || ${OPTIONS_OPEN}`, "my turn", 60000);
      if (await page.evaluate(OPTIONS_OPEN)) return page.evaluate(STATE);
      await page.press("r");
      await sleep(900);
    }
  };

  await page.waitUntil(CAN_ROLL, "my roll");
  let rolls = await sent("game:roll");
  const die = await page.centreOf(DIE);
  for (let i = 0; i < 10; i++) await page.click(die.x, die.y, 0);
  await sleep(1500);
  check("ten fast clicks on the die send one roll", (await sent("game:roll")) - rolls === 1, `${(await sent("game:roll")) - rolls} sent`);

  // Wait for a choice that leaves out at least one piece, so there is a wrong key to press.
  let state = await untilChoosing();
  while (state.options.length >= 4) {
    await page.press(pieceNumber(state.options[0]));
    await page.press("Enter");
    await sleep(900);
    state = await untilChoosing();
  }
  const before = await page.evaluate(PIECE_POSITIONS);
  const moves = await sent("game:move");
  rolls = await sent("game:roll");
  const offered = state.options.map(pieceNumber);
  const notOffered = ["1", "2", "3", "4"].filter((digit) => !offered.includes(digit));
  for (const digit of notOffered) await page.press(digit);
  await page.press("r");
  const other = await page.centreOf(`document.querySelector('[data-piece]:not([data-piece^="R"])')`);
  await page.click(other.x, other.y);
  await sleep(600);
  const after = await page.evaluate(STATE);
  check(
    `keys ${notOffered.join(", ") || "(none)"} for pieces that can't move, R after rolling and a click on another player's piece send nothing`,
    (await sent("game:move")) === moves && (await sent("game:roll")) === rolls,
  );
  check("the board and the choices are unchanged", (await page.evaluate(PIECE_POSITIONS)) === before && after.open && after.options.join() === state.options.join());

  await page.press(offered[0]);
  for (let i = 0; i < 3; i++) await page.press("Enter", { pause: 0 });
  await sleep(1200);
  check("Enter pressed three times fast sends one move", (await sent("game:move")) - moves === 1, `${(await sent("game:move")) - moves} sent`);

  // A six or a capture gives me another turn first, so play those out.
  const COMPUTERS_TURN = `!${CAN_ROLL} && !${OPTIONS_OPEN} && (document.querySelector('header p')?.innerText ?? '').includes('Computer')`;
  for (let tries = 0; !(await page.evaluate(COMPUTERS_TURN)); tries++) {
    if (tries > 600) throw new Error("the computer never got a turn");
    const now = await page.evaluate(STATE);
    if (now.canRoll) await page.press("r");
    else if (now.open) {
      await page.press(pieceNumber(now.options[0]));
      await page.press("Enter");
    }
    await sleep(50);
  }
  rolls = await sent("game:roll");
  const movesNow = await sent("game:move");
  for (const key of ["r", "1", "2", "Enter"]) await page.press(key, { pause: 30 });
  await sleep(300);
  check("R, 1, 2 and Enter during a computer's turn send nothing", (await sent("game:roll")) === rolls && (await sent("game:move")) === movesNow);

  await page.waitUntil(CAN_ROLL, "my next roll", 60000);
  rolls = await sent("game:roll");
  for (let i = 0; i < 10; i++) await page.press("r", { pause: 0 });
  await sleep(1500);
  check("R pressed ten times fast sends one roll", (await sent("game:roll")) - rolls === 1, `${(await sent("game:roll")) - rolls} sent`);
  check("nothing crashed", !(await page.evaluate(CRASHED)));
  reportErrors(page, "invalid");
  await page.close();
}

async function boundary(browser) {
  if (build) {
    console.log("boundary needs the dev server: the broken fixture isn't in the production build");
    return;
  }
  const page = await browser.page();
  await page.goto(`${APP}/?fixture=broken`, CRASHED);
  const names = await page.evaluate(BUTTON_NAMES);
  check("a board that can't be drawn shows the error screen", true);
  check("the error screen offers Try again", names.includes("Try again"), names.join(", "));
  await page.shot("NFR-SYS-03-error-boundary.png");
  // React reports the error it caught in a dev build, so these are expected here.
  console.log(`console errors from the crash itself: ${page.errors.length}`);
  await page.close();
}

async function smoke(browser) {
  const page = await browser.page();
  const code = await computerGame(page, FAST_RULES);
  check("start: the board appears", await page.evaluate(ON_BOARD));
  const stats = await play(page, { label: "smoke", stopAfter: 2 });
  check("roll and move", stats.moves === 2, JSON.stringify(stats));
  await winNow(page, code);
  const win = await page.evaluate(WIN_PAGE);
  check("win: the win screen appears", win.heading.includes("wins"), win.heading);
  reportErrors(page, "smoke");
  await page.close();
}

// ---------------------------------------------------------------------------------------------
// Main

const MODES = { keyboard, games, sizes, grayscale, contrast, perf, invalid, boundary, smoke };
if (!MODES[mode]) {
  console.error(`Unknown mode "${mode}". Use one of: ${Object.keys(MODES).join(", ")}.`);
  process.exit(2);
}
const browserPath = (BROWSERS[browserName] ?? []).find((candidate) => candidate && existsSync(candidate));
if (!browserPath) {
  console.error(`Couldn't find ${browserName}. Set CHROME_PATH or EDGE_PATH to its program file.`);
  process.exit(2);
}

const profile = mkdtempSync(path.join(os.tmpdir(), "ludo-e2e-profile-"));
let cdp = null;
try {
  await ensureFree(MOCK_PORT, "mock");
  await ensureFree(APP_PORT, "app");
  await ensureFree(DEBUG_PORT, "browser");
  mkdirSync(OUT, { recursive: true });

  const vite = path.join("node_modules", "vite", "bin", "vite.js");
  startNode([path.join("node_modules", "tsx", "dist", "cli.mjs"), "mock-server/index.ts", "--debug"], {
    PORT: String(MOCK_PORT),
  });
  if (build) {
    const dist = path.join(profile, "dist");
    execFileSync(process.execPath, [vite, "build", "--outDir", dist, "--emptyOutDir", "--logLevel", "warn"], {
      cwd: ROOT,
      stdio: "inherit",
      env: { ...process.env, VITE_SERVER_URL: MOCK },
    });
    startNode([vite, "preview", "--outDir", dist, "--port", String(APP_PORT), "--strictPort"]);
  } else {
    startNode([vite, "--port", String(APP_PORT), "--strictPort"], { VITE_SERVER_URL: MOCK });
  }
  const browserProcess = spawn(
    browserPath,
    [
      ...(headed ? [] : ["--headless=new"]),
      `--remote-debugging-port=${DEBUG_PORT}`,
      `--user-data-dir=${profile}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-extensions",
      "--disable-background-timer-throttling",
      "--disable-renderer-backgrounding",
      "--disable-backgrounding-occluded-windows",
      "--mute-audio",
      "--window-size=1280,720",
      "about:blank",
    ],
    { stdio: "ignore" },
  );
  children.push(browserProcess);

  await waitFor(`${MOCK}/api/v1/health`, "the mock server");
  await waitFor(APP, "the app");
  cdp = await connect();
  const { product } = await cdp.send("Browser.getVersion");
  const connection = cdp;
  const browser = { page: (w, h) => openPage(connection, w, h) };
  console.log(`mode ${mode} | ${product} | ${build ? "production build" : "dev server"} | ${fast ? "fast computer" : "default rules"} | output ${OUT}`);

  if (!build) {
    // Vite may reload the page once while it prepares dependencies, so get that over with first.
    const warmUp = await browser.page();
    await mainScreen(warmUp);
    await sleep(2500);
    await warmUp.close();
  }
  await MODES[mode](browser);
} catch (error) {
  problem(error instanceof Error ? error.message : String(error));
} finally {
  cdp?.close();
  for (const child of children.reverse()) stop(child);
  await sleep(500);
  try {
    rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
  } catch {
    // The browser can hold a file a moment longer. It is in the temp folder either way.
  }
  // Without --save the output folder is temporary, so don't leave it behind empty.
  if (!flags.has("save") && existsSync(OUT) && readdirSync(OUT).length === 0) {
    rmSync(OUT, { recursive: true, force: true });
  }
}

if (problems.length > 0) {
  console.log(`\nFAILED (${problems.length}):\n- ${problems.join("\n- ")}`);
  process.exitCode = 1;
} else {
  console.log("\nPASSED");
}
