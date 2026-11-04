# Requirement Notes 

## Functional Requirements (FR)

**FR-SYS-04 — Explain invalid moves and preserve state**
- *What it does:* When Game Logic rejects a move or the user makes an invalid action, the front end shows a short, clear explanation and keeps the last accepted game state. No piece positions, turns, or scores change.
- *Trigger:* A move is rejected or an invalid action is received.

**FR-SYS-05 — Animate accepted movement and show game events**
- *What it does:* After an accepted move, the board updates to the returned state. If animation is on, the piece moves step by step; if off, it jumps to the final position. Events like captures are shown in the message area.
- *Trigger:* Game Logic confirms a move and returns updated state + events.

**FR-SYS-06 — Display player progress and game completion**
- *What it does:* Shows each player's piece counts (base, track, destination). When Game Logic reports a player has finished, shows the winner screen with final status. Never calculates a winner independently.
- *Trigger:* Game state changes or completion is reported.

## Non-Functional Requirements (NFR)

**NFR-SYS-05 — Dice fairness**
- *What it does:* The front end displays exactly the dice value returned by Game Logic — no bias, no alteration, no substitution. Unbiased generation is Game Logic's job.

**NFR-SYS-06 — First-time player usability**
- *What it does:* A new player should understand the rules summary and complete a first turn without outside help.

**NFR-SYS-07 — Readability and color-blind accessibility**
- *What it does:* Text, pieces, and board squares must stay readable. Player identity must not rely on color alone — use labels, shapes, or icons too.

**NFR-SYS-08 — Simple wording and keyboard support**
- *What it does:* Rules and messages use short, simple language. Core actions (setup, roll, move selection, controls) must work with keyboard as well as mouse.
