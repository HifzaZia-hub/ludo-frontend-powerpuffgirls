# 05 — Traceability: requirement → task → proof

Keep this file up to date. It is the cheapest strong evidence of process you
can show a grader: every requirement in our D3 points to the code that
implements it and the check that proves it.

Run `/trace` after each task to refresh the **Status** column.

Status: `—` not started · `WIP` · `Done` · `Blocked (reason)`

## Functional requirements

| D3 ID | D2 user stories | Build task(s) | Proof (test or manual check) | Status |
|---|---|---|---|---|
| FR-SYS-01 Start and configure | FR-01–06 | P5 | `src/components/TextField.test.tsx` covers ALT-01-1 for one field only: an error keeps the typed value. There is no setup form yet. Still needed: setup form keeps typed values on a rejected request; 2/3/4 seats and both modes reach the board | WIP |
| FR-SYS-02 Turn and dice | FR-08–11 | P7 | `src/store/gameStore.test.ts` covers EXC-02-1: a second roll while one is pending sends nothing. `src/components/Dice.test.tsx` proves the die shows exactly the value it is given and ignores presses while rolling. It is not connected to the game yet. Still needed: die face equals `turn.lastRoll` on the game screen; double-click sends one roll | WIP |
| FR-SYS-03 Legal choices and move | FR-14–16, FR-18 | P8 | `src/store/gameStore.test.ts` covers EXC-03-2 in the store (an accepted move changes nothing until the snapshot arrives) and that legal moves come only from the server's list. There is no board yet. Still needed: only `legalMoves` pieces are buttons; destination preview shown; EXC-03-1 | WIP |
| FR-SYS-04 Invalid moves | FR-17 | P3, P8, P11 | `src/store/gameStore.test.ts` covers POST-04-1 (a rejected move leaves the snapshot deep-equal) and EXC-04-1 in the store (a timed-out command keeps state and clears pending). `src/adapter/LgsAdapter.test.ts` covers EXC-04-1 over a real socket (no ack, an ack for another request or an incomplete ack becomes `INTERNAL_ERROR`). Still needed: a test of the generic message (ALT-04-1); the explanation and a retry on the game screen (P8); recovery after a dropped connection (P11) | WIP |
| FR-SYS-05 Animation and events | FR-19, FR-23, FR-36, FR-38 | P8, P9 | `src/store/gameStore.test.ts` proves an event never changes the snapshot. Nothing animates or shows events yet. Still needed: animation off gives same final board; capture appears in message area | WIP |
| FR-SYS-06 Progress and completion | FR-25–29 | P6, P10 | `src/config/geometry.test.ts` covers `progressCounts` and `src/store/gameStore.test.ts` covers `selectProgress`. Still needed: status panel counts match snapshot; winner screen only on `GAME_OVER` | WIP |
| FR-SYS-07 Computer moves | FR-30–31 | P5, P7 | `src/store/gameStore.test.ts` covers `selectIsComputerTurn` only. Still needed: AI seat shows "Computer is thinking…"; its move renders from the snapshot | WIP |
| FR-SYS-08 Restart, exit, rematch | FR-32–34 | P10 | `src/components/ConfirmDialog.test.tsx` and `docs/evidence/NFR-SYS-08-kitchen-sink-checks.md` cover the dialog alone: Cancel and Esc never confirm. It isn't connected to restart or leave yet. Still needed: confirm dialog on restart/leave; cancel leaves game unchanged | WIP |
| FR-SYS-09 One-screen view | FR-35–36 | P6 | Board, dice, turn, progress, messages all visible at 1280×720 with no scroll | — |
| FR-SYS-10 Sound, animation, theme | FR-37–39 | P5, P8, P9 | `src/App.test.tsx` covers the theme switch through `src/store/settingsStore.ts`. `docs/evidence/NFR-SYS-08-kitchen-sink-checks.md` shows On, Fast and Off changing how long CSS motion takes. Sound is stored but nothing uses it yet. Still needed: toggle each mid-game; game state unchanged | WIP |
| (D2 FR-07) Rules summary | FR-07 | P5, P6 | `src/components/RulesSummary.test.tsx` proves the text is built from `rules`. Still needed: rules open from main screen and in-game | WIP |
| (D2 FR-03) Same-device HvH | FR-03 | P13 | TO CONFIRM | Blocked (same-device play is TO CONFIRM, `00-requirements.md` §5) |

## Non-functional requirements

| D3 ID | Build task(s) | Proof | Status |
|---|---|---|---|
| NFR-SYS-01 1 s acknowledgement | P4, P12 | `src/store/gameStore.test.ts` proves `pendingCommand` is set as soon as a roll is sent. `src/components/Button.test.tsx` and `Dice.test.tsx` prove the pending and rolling states. `docs/evidence/NFR-SYS-08-kitchen-sink-checks.md` shows "Rolling…" appearing at once. Still needed: Performance-panel trace on the real screens | WIP |
| NFR-SYS-02 AI within 2 s | P12 | Dev log of AI turn durations over one game | — |
| NFR-SYS-03 No crash | P6, P12 | Error boundary per screen; 5 full games without a crash | — |
| NFR-SYS-04 State kept on bad input | P3 | `src/store/gameStore.test.ts`: an older version is dropped, and a rejected or timed-out command leaves the snapshot deep-equal. `src/adapter/LgsAdapter.test.ts`: an incomplete reply is never applied. P11 adds the reconnect case | Done |
| NFR-SYS-05 Dice not altered | P7 | `src/components/Dice.test.tsx`: the face equals the value given, and no number shows while rolling. A search finds no `Math.random` in `src/`. Still needed: connect `Dice` to `turn.lastRoll` | WIP |
| NFR-SYS-06 First-timer completes a turn | P12 | Hallway test with one person; note result | — |
| NFR-SYS-07 Not colour alone | P4, P12 | `docs/evidence/NFR-SYS-07-player-marks.png`: the `PlayerMark` row in grayscale, where shape and letter still tell the four players apart. `PlayerMark` and `Piece` read `PLAYER_IDENTITY` in `src/config/players.ts`. Still needed: grayscale screenshot of the board | WIP |
| NFR-SYS-08 Simple wording + keyboard | P4–P10, P12 | `src/components/SegmentedControl.test.tsx`, `Dice.test.tsx`, `src/App.test.tsx` and `docs/evidence/NFR-SYS-08-kitchen-sink-checks.md` cover the controls on their own. Player-facing text is in `src/feedback/copy.ts`. Still needed: whole game played keyboard-only | WIP |
| NFR-SYS-09 Chrome / Firefox / Edge | P12 | Smoke test in each | — |
| NFR-SYS-10 Window sizes | P6, P12 | Screenshots at 1024, 1366, 1920 wide | — |
| NFR-SYS-11 Rules in config | P1, P6 | `src/config/geometry.test.ts` covers board geometry for all 4 colours. `mock-server/server.test.ts` proves `POST /debug/rules` changes `safeSquares` for the next match. `src/components/RulesSummary.test.tsx` proves the rules text follows `RuleConfig`. Still needed: change `safeSquares` in the mock → board stars move, rules text updates | WIP |
| NFR-SYS-12 Defined interfaces | P2, P3 | `src/store/gameStore.test.ts` runs the store against `FakeAdapter` with no network. `src/adapter/LgsAdapter.test.ts` runs the real adapter over real sockets. `eslint.config.js` blocks `socket.io-client` outside `src/adapter/` and blocks `src/` from importing the mock. `docs/evidence/NFR-SYS-12-connected-to-mock.png` shows the app connected to the mock | Done |
| NFR-SYS-13 Maintainable | all | PRs #1, #2 and #3 merged for P0, P1 and P2; folder layout followed. None of the three has a recorded review, and our D3 names PR reviews as the proof. PRs #4 and #5 are open, also with no review. Still needed: PR reviews; a PR for each remaining task | WIP |
| NFR-SYS-14 No storage for play | P3 | `docs/evidence/NFR-SYS-14-storage-check.md`: outside test setup, only `src/store/settingsStore.ts` uses `localStorage`, and after a game the browser holds only the display settings. Saving them stays behind `PERSIST_SETTINGS` (ALT-10-1 is TO CONFIRM) | Done |

## Evidence folder

Save screenshots and short notes to `docs/evidence/` with the requirement ID in
the file name, e.g. `NFR-SYS-07-grayscale.png`. You will want these for the
next deliverable.
