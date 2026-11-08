# Ludo Front-End Kit — Power Puff Girls

Claude Code setup for the Ludo front end. Built from:
- our **D2 v1** and **D3 v1.1** (what we must build — graded),
- the backend team's **LGS D3** (how we talk to the server),
- the mockup sheets and the agreed tech stack.

## Install

Copy everything into the root of your empty front-end repo, then:

```bash
git init && git add -A && git commit -m "chore: project rules, specs and prompts"
```

Open Claude Code there. Accept the trust dialog (it lists the pre-approved
commands from `.claude/settings.json`). Run `/context` to confirm `CLAUDE.md`
loaded.

## What's here

```
CLAUDE.md                     always-loaded project rules
docs/
  00-requirements.md          our D2/D3 in short + where they clash with the backend
  01-contract.md              LGS REST + socket contract, errors, GameAdapter interface
  02-board-model.md           verified board geometry, progress counts, rule mapping
  03-ui-spec.md               dark + light tokens, screens, keyboard map, wording
  04-build-plan.md            P0–P14 with the requirement IDs each one covers
  05-traceability.md          requirement → code → proof (keep it updated)
.claude/
  settings.json               pre-approved and blocked commands
  skills/ludo-contract/       auto-loads for adapter/store/state work
  skills/ludo-ui/             auto-loads for screens/components work
  commands/task.md            /task N
  commands/verify.md          /verify
  commands/trace.md           /trace [ID]
  commands/contract-check.md  /contract-check [source]
  commands/desync.md          /desync <symptom>
prompts/
  00-how-to-use.md            READ FIRST
  P0 … P12                    MVP — tag v1.0-mvp after P12
  P13                         same-device play (TO CONFIRM)
  P14                         polish
```

## Start here

1. Read `prompts/00-how-to-use.md`.
2. Take the table in `docs/00-requirements.md` §5 to your teacher/TA and the
   backend team.
3. `/clear`, then `/task 0`.
