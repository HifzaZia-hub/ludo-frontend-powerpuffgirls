# 04 — Build Plan

Fifteen tasks, in order. Each is one Claude Code session and ends with a PR.
Do not start a task until the one before it builds and runs.

Each prompt in `prompts/` starts with the requirement IDs it implements. Update
`docs/05-traceability.md` when a task is done.

| # | Task | Implements | Tier | Done when |
|---|---|---|---|---|
| P0 | Scaffold: Vite, TS, Tailwind, tooling, dark + light tokens | NFR-SYS-13 | MVP | dev page shows in both themes; typecheck/lint/build pass |
| P1 | Contract types, config (board, players, default rules), geometry | NFR-SYS-11 | MVP | geometry tests pass for all 4 colours |
| P2 | Mock server (fake LGS) | — (enables everything) | MVP | a whole game vs 3 computers plays to a winner |
| P3 | `GameAdapter` + `LgsAdapter` + `FakeAdapter` + stores | NFR-SYS-12, NFR-SYS-04, NFR-SYS-14, FR-SYS-04 | MVP | store tests pass against `FakeAdapter`; app connects to mock |
| P4 | Design system components | NFR-SYS-07, NFR-SYS-08, NFR-SYS-01 | MVP | kitchen sink shows every component in both themes |
| P5 | Main screen, setup, lobby, settings, rules summary | FR-SYS-01, FR-SYS-10, D2 FR-07 | MVP | two tabs create + join + start; settings change theme live |
| P6 | Game screen: board, status panel, message area, layout | FR-SYS-09, FR-SYS-06 (counts), NFR-SYS-10, NFR-SYS-11 | MVP | fixtures render correctly; all info on one screen at 1280×720 |
| P7 | Dice, turn indicator, turn gating | FR-SYS-02, NFR-SYS-05, FR-SYS-07 (display) | MVP | die always lands on the server value |
| P8 | Move choice, preview, step animation, skip | FR-SYS-03, FR-SYS-05, FR-SYS-04 | MVP | a full game is playable by mouse **and** keyboard |
| P9 | Event feedback: capture, finish, extra turn, messages, sound | FR-SYS-05, FR-SYS-10 (sound) | MVP | capture sequence plays in order; message log reads correctly |
| P10 | Win screen, restart, leave, confirm dialogs, session score | FR-SYS-06, FR-SYS-08 | MVP | match ends cleanly; cancel leaves game unchanged |
| P11 | Disconnect, reconnect, resync | NFR-SYS-03, NFR-SYS-04, FR-SYS-04 | MVP | F5 mid-game restores the board |
| P12 | Requirements pass: accessibility, browsers, sizes, evidence | NFR-SYS-01…10 | MVP | every NFR row in traceability has proof |
| P13 | Local multi-seat (same-device play) | D2 FR-03 | **TO CONFIRM** | only if the client and backend confirm |
| P14 | Polish: extra themes, 3D die/pieces, confetti, music | — | Polish | cut first if short on time |

**Demo-safe point:** after P12, tag `v1.0-mvp`. If anything later breaks, you
demo that tag.

**Integration point:** after P3, swap `VITE_SERVER_URL` to the real LGS. Do it
in week 1. The first real connection always exposes a field-name mismatch.

---

## Why P12 exists

Our D3 lists a **verification method** next to every NFR (Table §5). Graders
will check that you did what you said. P12 is the task where you run those
checks and save the evidence. It is not optional and it is not "polish".

## Why P13 is separate

D2's casual player (Rida) plays with friends **on one device**. The backend
gives each human their own session, so one-device play means one browser
holding several seats. It is doable (`LocalMultiSeatAdapter`) but it is extra
work and it depends on the backend allowing it. Ask first (open question in
`01-contract.md`). If the client says network play is enough, delete P13.

## Honest note on 3D

The tech-stack plan says Screen 3 is "one 3D canvas". Don't build the board in
react-three-fiber first:

- A 15×15 CSS-grid board with positioned pieces is ~150 lines and easy to
  debug. In r3f it is camera maths, raycasting for clicks, and a much harder
  step-by-step walk animation.
- **Keyboard play (NFR-SYS-08)** and **screen-reader labels** are free with
  real `<button>` pieces and hard inside a WebGL canvas.
- Grading is on the requirements, not the render target.

Build the 2D board behind `<PieceLayer>` with clean props. In P14, a
`<PieceLayer3D>` with the same props can be swapped in by a setting. The 3D
**die** is the safer place to show off r3f — one mesh, no interaction.

---

## Git discipline

One branch per task: `feat/p06-board`. Conventional commits with the
requirement ID: `feat(board): status panel counts (FR-SYS-06)`. Open a PR for
every task even if nobody reviews it. Keep `CHANGELOG.md` with one line per
task. The PR history plus the traceability file is your process evidence.
