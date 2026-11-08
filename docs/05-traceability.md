# 05 — Traceability: requirement → task → proof

Keep this file up to date. It is the cheapest strong evidence of process you
can show a grader: every requirement in our D3 points to the code that
implements it and the check that proves it.

Run `/trace` after each task to refresh the **Status** column.

Status: `—` not started · `WIP` · `Done` · `Blocked (reason)`

## Functional requirements

| D3 ID | D2 user stories | Build task(s) | Proof (test or manual check) | Status |
|---|---|---|---|---|
| FR-SYS-01 Start and configure | FR-01–06 | P5 | Setup form keeps typed values on a rejected request; 2/3/4 seats and both modes reach the board | — |
| FR-SYS-02 Turn and dice | FR-08–11 | P7 | Test: die face equals `turn.lastRoll`; double-click sends one roll | — |
| FR-SYS-03 Legal choices and move | FR-14–16, FR-18 | P8 | Only `legalMoves` pieces are buttons; destination preview shown; no optimistic move | — |
| FR-SYS-04 Invalid moves | FR-17 | P3, P8, P11 | Store test: rejected command leaves snapshot unchanged; friendly message shown | — |
| FR-SYS-05 Animation and events | FR-19, FR-23, FR-36, FR-38 | P8, P9 | Animation off gives same final board; capture appears in message area | — |
| FR-SYS-06 Progress and completion | FR-25–29 | P6, P10 | `src/config/geometry.test.ts` covers `progressCounts` only. Still needed: status panel counts match snapshot; winner screen only on `GAME_OVER` | WIP |
| FR-SYS-07 Computer moves | FR-30–31 | P5, P7 | AI seat shows "Computer is thinking…"; its move renders from the snapshot | — |
| FR-SYS-08 Restart, exit, rematch | FR-32–34 | P10 | Confirm dialog on restart/leave; cancel leaves game unchanged | — |
| FR-SYS-09 One-screen view | FR-35–36 | P6 | Board, dice, turn, progress, messages all visible at 1280×720 with no scroll | — |
| FR-SYS-10 Sound, animation, theme | FR-37–39 | P5, P8, P9 | `src/App.test.tsx` covers the theme switch only. Still needed: toggle each mid-game; game state unchanged | WIP |
| (D2 FR-07) Rules summary | FR-07 | P5, P6 | Rules open from main screen and in-game; text built from `rules` | — |
| (D2 FR-03) Same-device HvH | FR-03 | P13 | TO CONFIRM | Blocked (same-device play is TO CONFIRM, `00-requirements.md` §5) |

## Non-functional requirements

| D3 ID | Build task(s) | Proof | Status |
|---|---|---|---|
| NFR-SYS-01 1 s acknowledgement | P4, P12 | Every control has a pending state; Performance-panel trace | — |
| NFR-SYS-02 AI within 2 s | P12 | Dev log of AI turn durations over one game | — |
| NFR-SYS-03 No crash | P6, P12 | Error boundary per screen; 5 full games without a crash | — |
| NFR-SYS-04 State kept on bad input | P3 | `gameStore.test.ts` | — |
| NFR-SYS-05 Dice not altered | P7 | `Dice.test.tsx`; grep shows no `Math.random` in `src/` outside tests | — |
| NFR-SYS-06 First-timer completes a turn | P12 | Hallway test with one person; note result | — |
| NFR-SYS-07 Not colour alone | P4, P12 | Code in `src/config/players.ts` and the starter page (`src/App.tsx`); no test or evidence file yet. Still needed: grayscale screenshot of the board | WIP |
| NFR-SYS-08 Simple wording + keyboard | P4–P10, P12 | `src/App.test.tsx` covers the keyboard theme switch only. Still needed: whole game played keyboard-only; copy table in `03-ui-spec.md` | WIP |
| NFR-SYS-09 Chrome / Firefox / Edge | P12 | Smoke test in each | — |
| NFR-SYS-10 Window sizes | P6, P12 | Screenshots at 1024, 1366, 1920 wide | — |
| NFR-SYS-11 Rules in config | P1, P6 | `src/config/geometry.test.ts` covers board geometry for all 4 colours. Still needed: change `safeSquares` in the mock → board stars move, rules text updates | WIP |
| NFR-SYS-12 Defined interfaces | P3 | Store tests use `FakeAdapter`; only `src/adapter/` imports socket.io | — |
| NFR-SYS-13 Maintainable | all | PR #1 merged for P0 and PR #2 for P1; folder layout followed. Still needed: a PR for each remaining task | WIP |
| NFR-SYS-14 No storage for play | P3 | Only `settingsStore` uses `localStorage` | — |

## Evidence folder

Save screenshots and short notes to `docs/evidence/` with the requirement ID in
the file name, e.g. `NFR-SYS-07-grayscale.png`. You will want these for the
next deliverable.
