---
description: Run the full definition-of-done check before claiming a task is finished
allowed-tools: Bash(npm run *), Bash(npm test *), Bash(git status *), Bash(git diff *), Bash(grep *)
---

Run the definition of done from `CLAUDE.md` §7. Actually run the commands.

1. `npm run typecheck`
2. `npm run lint`
3. `npm run build`
4. `npm test`

Then check the diff (`git diff main...HEAD`) and answer each question with
evidence (quote lines or command output):

**Rules stay on the server**
- Any dice value, legality, capture, turn, winner, ranking or score decided
  on the client?
- Any piece position set from something other than a snapshot?
- Any `Math.random` outside tests? (`grep -rn "Math.random" src --include=*.ts --include=*.tsx`)

**Adapter boundary (NFR-SYS-12)**
- Does anything outside `src/adapter/` import `socket.io-client` or call
  `fetch`? (grep for both)

**Our NFRs**
- Any raw hex colour in `src/components` or `src/screens`? (NFR-SYS-07, themes)
- Any player-facing string not from `src/feedback/copy.ts` or the message
  templates? (NFR-SYS-08)
- Any new interactive element that is not a `<button>`, `<input>` or `<a>`?
  (NFR-SYS-08)
- Any `localStorage` use outside `settingsStore`? (NFR-SYS-14)

**Requirements for this task**
- List each requirement ID from the task's prompt. For each, say Met / Not
  met / Partly, with one line of proof.
- Is `docs/05-traceability.md` updated for those IDs?

**Hygiene**
- Any `any`, or `!` without a comment? Any dependency not in the locked stack?
- Any field name not in `docs/01-contract.md`?

Finish with a blunt report: what passed, what failed, and what you did **not**
do that I might assume you did.
