# Requirement Notes — Hifza Zia

## My Assigned Functional Requirements (FR)

**FR-SYS-07 — Request and present computer-player moves**
- *What it does:* When it is the computer's turn, the front end asks the Game AI for a move, sends that move to Game Logic to be validated, and then shows the result on the screen.
- *Trigger:* A computer-controlled player's turn begins.

**FR-SYS-08 — Control game restart, exit and rematch**
- *What it does:* Gives the player buttons to Restart, Exit, or start a Rematch. It asks "Are you sure?" before deleting current progress.
- *Trigger:* Player clicks Restart, Exit, or New Game.

**FR-SYS-09 — Provide board, player and action information in one view**
- *What it does:* Puts the board, pieces, dice, whose turn it is, player progress, and the last action message all on one screen so you don't have to click around.
- *Trigger:* Player enters the active game view.

**FR-SYS-10 — Manage sound, animation and visual theme settings**
- *What it does:* Lets the player turn sound on/off, skip animations, and switch between light/dark mode.
- *Trigger:* Player opens the settings menu.

## My Assigned Non-Functional Requirements (NFR)

**NFR-SYS-09 — Desktop browser compatibility**
- *What it does:* The game must work on Chrome, Firefox, and Edge without installing anything.

**NFR-SYS-10 — Responsive layout**
- *What it does:* If you resize the browser window, the game screen must adapt so you can still see the board and buttons.

**NFR-SYS-11 — Separate rules/configuration from presentation**
- *What it does:* Hard-coded numbers (like how many pieces a player has) shouldn't be inside the HTML/CSS. They should be in a config file.

**NFR-SYS-12 — Defined replaceable component interfaces**
- *What it does:* The front end talks to Game Logic and AI through a strict interface (like a plug). If another team builds a better AI, we can just plug it in.

**NFR-SYS-13 — Maintainable shared codebase**
- *What it does:* The code must be clean and commented so all of us can read and edit it without getting confused.
