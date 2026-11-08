---
description: Compare our contract types against the backend's real contract
argument-hint: [path or URL to the backend contract, optional]
---

Audit our integration surface against the backend's contract.

Source to compare against: $ARGUMENTS
(If that is empty, compare against `docs/01-contract.md` and report where our
code and that doc disagree.)

Produce a table with one row per mismatch:

| Our code | Our doc | Backend | Risk |

Cover: REST paths and bodies, socket command names, socket event names, every
field in `GameStateSnapshot`, `RoomSnapshot`, `Player`, `Piece`, `LegalMove`,
`TurnState`, and every error code.

Also check `src/adapter/GameAdapter.ts` against `docs/01-contract.md` §9.

Then:
1. List the fields we are **guessing** — present in our types but not confirmed
   anywhere. These are the ones that will break integration day.
2. Update the open-questions checklist at the bottom of `docs/01-contract.md`.
3. Re-check the "disagree" table in `docs/00-requirements.md` §5 — has the
   backend answered any of those? Note which rows can be closed.
4. Draft a short, polite message I can paste to the backend team's Integration
   & QA Lead asking only the questions that are still open. Keep it under 150
   words and make it easy to answer with a yes/no or a one-line reply.

Do not change any code in this command. Report only.
