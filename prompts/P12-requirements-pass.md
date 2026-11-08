# P12 — Requirements pass: accessibility, browsers, sizes, evidence

**Implements:** proof for NFR-SYS-01 … NFR-SYS-10 (our D3 §5 "Verification"
column)
**Read first:** `docs/00-requirements.md` §4, `docs/05-traceability.md`

Our D3 promised a verification method for every NFR. This task runs them and
saves the evidence. It is MVP. When it is done, tag `v1.0-mvp`.

Use subagents for the audits so their file reading stays out of the main
context, e.g. *"Use a subagent to audit every player-facing string in src/ for
NFR-SYS-08 and report any that are long, technical or blaming."*

## Checks — fix what fails, then record the proof

| NFR | Check | Evidence file |
|---|---|---|
| 01 | Chrome Performance panel: click Roll and Move; time to first visual change < 1 s (target well under 100 ms) | `NFR-SYS-01-perf.png` |
| 02 | Dev log of computer turn durations for one full game; report max | `NFR-SYS-02-ai-times.md` |
| 03 | Play 5 full games (HvC) without a crash; error boundary tested by throwing in dev | `NFR-SYS-03-runs.md` |
| 04 | Store tests from P3 green; plus rapid-click and invalid-move manual test | test output in `NFR-SYS-04.md` |
| 05 | `Dice.test.tsx` green; grep proves no `Math.random` in `src/` | `NFR-SYS-05.md` |
| 06 | Hallway test: someone who hasn't seen the app reads the rules and plays a first turn alone. Note what confused them, and fix it. | `NFR-SYS-06-first-use.md` |
| 07 | Board, status panel and win screen in grayscale (DevTools → Rendering → Achromatopsia), both themes | `NFR-SYS-07-*.png` |
| 08 | Whole game keyboard-only: setup → lobby → roll → select → move → restart → leave. Plus a wording review of `copy.ts` and `messages.ts` | `NFR-SYS-08-keyboard.md` |
| 09 | Smoke test (start, roll, move, win) in latest Chrome, Firefox, Edge | `NFR-SYS-09-browsers.md` (versions + result) |
| 10 | Screenshots at 1024×768, 1366×768, 1920×1080 in the game screen | `NFR-SYS-10-*.png` |

All files go in `docs/evidence/`. Keep notes short: what you did, what
happened, what you fixed.

Automate what you can: a Playwright script that plays a keyboard-only HvC
game against the mock and takes the size screenshots is worth writing — you
can rerun it before the demo.

## Also
- Light theme: walk every screen once. Fix any contrast problem.
- Run `/trace` and make sure every row in `docs/05-traceability.md` is `Done`
  or has an honest `Blocked (reason)`.
- `CHANGELOG.md` entry, then `git tag v1.0-mvp`.

## Done when
Every NFR row in the traceability file names a real evidence file or test,
and the tag exists.
