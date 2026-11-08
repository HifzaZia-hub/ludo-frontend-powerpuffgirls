---
description: Refresh docs/05-traceability.md from the code and tests
argument-hint: [requirement ID, optional — e.g. FR-SYS-03]
---

Update the traceability matrix in `docs/05-traceability.md`.

Scope: $ARGUMENTS (if empty, check every row).

For each requirement row in scope:

1. Find the code that implements it. Search for the requirement ID in
   comments and commit messages (`git log --grep`), then confirm by reading
   the code.
2. Find the proof: a test that covers it, or a file in `docs/evidence/`.
   Run the test if there is one.
3. Set **Status** to `Done` only if both the code and a passing proof exist.
   `WIP` if code exists but proof is missing. `Blocked (reason)` if an open
   decision in `docs/00-requirements.md` §5 stops it.
4. In the Proof column, name the actual test file or evidence file.

Do not mark anything `Done` on the strength of code alone.

Finish with a short list: requirements still `—` or `WIP`, in build-plan
order, so I know what is left.
