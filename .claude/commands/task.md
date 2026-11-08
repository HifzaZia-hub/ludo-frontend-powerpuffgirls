---
description: Start a numbered build-plan task from prompts/
argument-hint: <task number, e.g. 6>
---

Start build-plan task **P$ARGUMENTS**.

Do these in order:

1. Read `CLAUDE.md`, `docs/04-build-plan.md`, and the prompt file for this task
   in `prompts/` (its name starts with `P$ARGUMENTS-`).
2. Read the docs the prompt points to. Always read the rows of
   `docs/00-requirements.md` for every requirement ID the prompt lists.
3. Check `git status` is clean. If not, stop and tell me.
4. Create a branch `feat/p$ARGUMENTS-<short-name>`.
5. Show me a short plan:
   - the requirement IDs this task covers, and for each one the PRE/POST or
     EXC condition that most affects the code
   - the files you will create or change, one line each
   - anything in the prompt that looks wrong, or conflicts with
     `docs/00-requirements.md` §5
   **Then stop and wait for my go-ahead.** Do not write code yet.

Keep the plan under 20 lines.
