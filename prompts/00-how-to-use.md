# 00 — How to use Claude Code on this project

Read this once. It is the difference between Claude Code building your game and
Claude Code making a mess you spend two days untangling.

---

## Setup (do this once, takes 10 minutes)

1. Copy this whole kit into your empty repo. Keep the structure:
   `CLAUDE.md` at the root, `docs/`, `prompts/`, `.claude/`.
2. `git init && git add -A && git commit -m "chore: project rules and specs"`
3. Install the `gh` CLI and run `gh auth login`. Claude uses it for branches,
   PRs and issues, and it is far more context-efficient than the raw API.
4. Open Claude Code in the repo and run `/context`. Confirm it shows `CLAUDE.md`
   loaded. If it does not, nothing else in this kit will work.
5. Permissions are already set up: `.claude/settings.json` pre-approves
   `npm run *`, `npm test *`, the everyday git commands and `gh pr create`,
   and blocks `git push --force` and `rm -rf`. The first time you open the
   repo, Claude Code shows a **trust dialog** listing these rules — read them
   and accept. Run `/permissions` any time to see or change them.
   (Personal extras go in `.claude/settings.local.json`, which you should
   gitignore.)

---

## Our requirements come first

`docs/00-requirements.md` is a short version of **our own D2 and D3**. That is
what the course grades. Every prompt in this folder starts with an
**Implements:** line naming the requirement IDs it covers (FR-SYS-…,
NFR-SYS-…). Every PR names them too. After each task, run `/trace` to update
`docs/05-traceability.md`.

By the end you will have a table that says, for every requirement in our D3:
here is the code, here is the test or screenshot that proves it. That table
plus a clean PR history is the strongest process evidence you can hand in.

Where our D3 and the backend server disagree (colour choice, same-device play,
extra-turn rules, ranking…), `docs/00-requirements.md` §5 lists each one.
Take that table to your teacher/TA and the backend team **early**.

---

## The one idea that matters most

**Context is the scarce resource, not Claude's intelligence.**

Everything Claude reads — your messages, every file, every command output —
sits in one window, and quality drops as it fills. A session where you did six
unrelated things is a session where Claude has started forgetting your rules.

So: **one task per session.** Finish task 6, commit, `/clear`, start task 7.
Do not run the whole project in one long chat. This single habit will matter
more than any prompt you write.

---

## The loop for each task

```
/clear                      ← always start clean
Shift+Tab                   ← until the bar shows "plan mode on"
/task 6                     ← loads CLAUDE.md, the build plan, prompts/P6-*,
                              and the requirement rows it lists; shows a plan, stops
[read the plan, correct it] ← this is the highest-value 60 seconds you'll spend
Shift+Tab                   ← approve, leave plan mode
"go ahead"
[Claude builds]
/verify                     ← runs typecheck, lint, build, tests + requirement checks
[fix whatever it reports]
/trace                      ← updates the traceability table
"commit and open a PR"
/clear
```

### Why plan mode first

In plan mode Claude reads and thinks but cannot edit files. You get to see
what it *intends* to do while it is still cheap to change. Nine times out of
ten you will catch one wrong assumption in the plan, and fixing it there costs
one sentence instead of a rewrite.

Skip plan mode only when the change is one sentence long ("rename this prop",
"fix this typo"). Planning has real overhead; do not ritualise it.

### Why /verify matters

Claude stops when work *looks* done. Without a check it can run, "looks done"
is the only signal it has, and you become the test suite. `/verify` makes it
run the typecheck, the lint and the build and report real output. Ask for
evidence, not assurances. If Claude says "this works", ask "show me the
command you ran and what it printed."

---

## Correcting Claude

- **`Esc`** — stop it mid-action. Context is kept, so you can redirect
  immediately. Use this the second you see it going somewhere wrong. Do not
  politely wait for it to finish a bad approach.
- **`Esc Esc`** or **`/rewind`** — restore the conversation, the code, or both
  to an earlier point. Checkpoints are made at every prompt you send. This
  means you can tell Claude to try something risky and just rewind if it fails.
  (Caveat: checkpoints only track Claude's own file edits, not changes made
  through Bash. It is not a git replacement — keep committing.)
- **The two-correction rule.** If you have corrected Claude twice on the same
  thing and it is still wrong, stop. The context is now full of failed
  attempts, which actively makes the next attempt worse. `/clear` and rewrite
  the prompt including what you learned. A clean session with a better prompt
  beats a long session with accumulated corrections almost every time.

---

## What is in this kit and when each piece fires

| Thing | When it loads | What it is for |
|---|---|---|
| `CLAUDE.md` | every session, automatically | the rules that always apply |
| `docs/00-requirements.md` | when `/task` or a prompt points at it | our D2/D3 requirements, and where they clash with the backend |
| `docs/05-traceability.md` | when you run `/trace` | requirement → code → proof |
| `.claude/settings.json` | every session | pre-approved and blocked commands |
| `.claude/skills/ludo-contract/` | when a task touches adapter/store/contract | server integration rules |
| `.claude/skills/ludo-ui/` | when a task touches components/screens | visual and interaction rules |
| `prompts/P*.md` | when you run `/task N` | the actual work order |
| `docs/*` | when a prompt or skill points at them | reference, not always-on |

This split is deliberate. `CLAUDE.md` is loaded into **every** conversation, so
it must stay short — a bloated CLAUDE.md gets half-ignored, which is worse than
a short one. Everything that is only sometimes relevant lives in a skill or a
doc, loaded on demand.

If Claude starts ignoring a rule in `CLAUDE.md`, the file has probably grown
too long. Prune it, or move the rule into a hook so it is enforced rather than
requested.

### Your slash commands

- `/task N` — start build-plan task N properly (branch, read docs, plan, stop)
- `/verify` — the full definition-of-done check, with real command output,
  including our NFR checks (no raw colours, keyboard, adapter boundary…)
- `/trace [ID]` — refresh the traceability table from code and tests
- `/contract-check [source]` — audit our types against the backend's contract
  and draft the message to send the backend team
- `/desync <what you saw>` — structured debugging for state/position bugs

---

## Using subagents (keeps your context clean)

When you need Claude to *look at a lot of things* rather than change them, say
so explicitly:

> Use subagents to find every place we read a piece position, and report
> whether any of them comes from somewhere other than the current snapshot.

A subagent reads in its own separate context and reports back a summary. The
fifty files it opened never enter your window. Use this for investigation,
audits and "where is X used" questions.

The other good use is **adversarial review**. After Claude builds something:

> Use a subagent to review this diff against prompts/P8-moves.md. Check every
> requirement is implemented and nothing outside the task's scope changed.
> Report only gaps that affect correctness, not style preferences.

A fresh reviewer that did not write the code is much better at finding what is
missing. There is also a built-in `/code-review` that reviews the current diff
in a fresh subagent.

One warning: a reviewer asked to find problems will find some even when the
work is fine. Tell it to flag only correctness gaps, and do not chase every
note or you will end up with defensive over-engineering.

---

## Prompting: what actually changes the output

Being specific is worth more than being polite. Compare:

| Weak | Strong |
|---|---|
| "build the board" | "build the board from `docs/02-board-model.md`. Render from a snapshot only. Verify with the `edges` fixture and tell me, colour by colour, that each step-51 piece sits next to its own home column." |
| "add a status panel" | "implement FR-SYS-06's progress counts: base / track / home per player from `progressCounts()`. POST-06-1: counts must match the snapshot. Add a test with a fixture." |
| "fix the dice bug" | "the die sometimes shows a different number than the piece moves. Check `src/components/Dice.tsx` and the ROLLED handler. The landing face must come from `turn.lastRoll`, never a random value. Write a test." |
| "make it look better" | "[paste mockup screenshot] match this. Take a screenshot of the result, compare, list the differences, fix them." |

Three habits:
1. **Point to a file.** Use `@` to reference files — `@docs/01-contract.md` —
   instead of describing where something is.
2. **Paste screenshots.** Drag the mockup images straight into the prompt when
   you build a screen. This is dramatically more effective than describing a
   layout in words.
3. **State what "done" means** in the prompt itself, as a check Claude can run.

### Let Claude interview you for the fuzzy parts

Before a task where you are not sure what you want (the move-selection
interaction, for example):

> I want to build the move selection UX for Ludo. Interview me in detail using
> the AskUserQuestion tool. Ask about interaction, edge cases and tradeoffs.
> Don't ask obvious questions. Then write the spec to prompts/P8-moves.md.

Then `/clear` and build from the spec in a fresh session.

---

## Working with the other team's backend

This matters more than anything else for your grade, because integration is
where paired projects fail.

1. **Build the mock server (P2) before anything that talks to a server.**
   It is the single highest-leverage task in the plan. It lets your team work
   at full speed without waiting, and it means your demo works even if their
   server is down on the day.
2. **Swap in the real server URL in week 1**, not in the last week. The first
   real connection always exposes a field-name mismatch. Find it when it is a
   five-minute fix.
3. **Run `/contract-check` after every change on their side.** It produces the
   mismatch table and drafts the question list for you.
4. **Never guess a field name.** `isAi` vs `isAI` will cost a day. The open
   questions list at the bottom of `docs/01-contract.md` exists for this — keep
   it alive and get answers in writing on a GitHub issue, not in WhatsApp.

---

## Things that will go wrong, and the fix

| Symptom | Real cause | Fix |
|---|---|---|
| Claude ignores a rule you wrote | `CLAUDE.md` too long | prune it; add `IMPORTANT` to that one line only |
| Code quality drops late in a session | context is full | `/clear` and restart the task |
| Claude invents a server field | the contract doc did not cover it | add it to the open-questions list and ask the backend team |
| Claude writes game rules in the client | it was not pointed at the skill | say "read the ludo-contract skill first" |
| Big refactor goes sideways | too much in one task | `/rewind`, split into two tasks |
| "It works" but it does not | no verification was run | always finish with `/verify` |

---

## Honest advice about this kit

Three things worth saying plainly:

**Do not treat these prompts as sacred.** They are my best guess at your tasks.
When one of them is wrong for your situation, edit the file. The prompt pack is
part of the repo — improving it as you learn is the point, and a commit history
showing that is good evidence of process for the course.

**Your grade is on your D3, not on the mockups.** The mockups are beautiful
and the stack is ambitious. But our D3 asks for things the mockups don't show
— a light theme, full keyboard play, a base/track/home status panel, a
message log, a rules summary, confirm dialogs — and doesn't ask for 3D at all.
Build what the D3 says first (P0–P12), then polish (P14). See the 3D note in
`docs/04-build-plan.md`.

**Claude Code is fastest when you go slowly at the start.** The hour you spend
on P1–P3 (types, mock server, adapter + store) decides whether tasks 6–11 take two
days or two weeks. The version guard in the store is the single piece of code
most likely to save you — or ruin you — in the demo.
