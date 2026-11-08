# 00 — Our Requirements (D2 v1 + D3 v1.1)

**This is what we are graded against.** Source: our own deliverables —
*D2 Requirements Elicitation v1 (18 Oct 2026)* and *D3 System Requirements
Specification v1.1 (4 Nov 2026)*, team Power Puff Girls.

The backend contract (`01-contract.md`) says **how** we talk to the server.
This file says **what** the front end must do. When code is written, it should
name the requirement it implements (e.g. `FR-SYS-03`).

---

## 1. Who we are building for (D2 personas)

| Persona | What they need from the UI |
|---|---|
| **Rida**, 20, casual | Start in a few clicks. Clear board, big dice button, obvious turn. Told at once when a move is not allowed. Plays vs computer, sometimes with friends **on the same device**. |
| **Hamza**, 24, competitive | All players' progress at a glance (base / track / home). Strict rules, fair dice. **Skip or turn off animations.** Fast restart. |
| **Maryam**, 12, first-timer | Shown which pieces can move and where they land. **Short rules summary before and during the game.** Friendly, simple wording. Easily put off by error messages. |

Use these to settle design arguments. "Would Maryam understand this message?"
is a better test than "does it look like the mockup?"

---

## 2. Working game rules (D3 §2.2)

The server enforces these. We only display and explain them.

| ID | Rule |
|---|---|
| R1 | 2, 3 or 4 players, 4 pieces each, colours red/green/yellow/blue. A 2-player game uses opposite corners. |
| R2 | Fixed clockwise order. Player 1 starts. One six-sided die per turn. |
| R3 | A piece leaves the base only on a 6, onto its colour's start square. |
| R4 | Clockwise round the 52-square track, then 5 home-column squares to the centre. 56 steps from start to finish. |
| R5 | A 6 gives another turn. Three 6s in a row lose the turn. |
| R6 | If any move is valid, the player must move one piece the full roll. If none, the turn is skipped automatically. |
| R7 | Landing on an opponent sends it back to its base. |
| R8 | The 4 start squares and 4 star squares are safe. |
| R9 | Own pieces may share a square. No blocking. |
| R10 | Exact roll needed to reach the centre. |
| R11 | First player with all 4 pieces home wins and the game ends. (Our D3 says no ranking of the others — but see §5.) |

---

## 3. Functional requirements (D3 §4)

Only the parts that change code are listed. Read the D3 for the full use cases.

| ID | Requirement | Key conditions to honour in code |
|---|---|---|
| **FR-SYS-01** Start and configure | Setup flow: 2/3/4 seats, HvH or HvC, a name and colour per seat. | ALT-01-1 / EXC-01-1: on a rejected or failed setup, **keep what the player typed**, show the error, allow retry. |
| **FR-SYS-02** Active turn and dice | Show the active player; one clear dice control; show the server's result. | POST-02-2: shown value **equals** server value. EXC-02-1: ignore extra roll clicks while one is pending. EXC-02-2: on failure keep state, show retry. |
| **FR-SYS-03** Legal choices and move | Highlight only server-listed movable pieces; select; preview destination; submit. | POST-03-1: only listed pieces selectable. EXC-03-1: piece no longer legal → show reason, refresh options. EXC-03-2: **never move optimistically.** |
| **FR-SYS-04** Invalid moves keep state | Explain the rejection; keep the last accepted state. | POST-04-1: invalid action never changes positions, turn or scores. ALT-04-1: no explanation → generic friendly message. EXC-04-1: incomplete response → don't guess, keep state, offer retry. |
| **FR-SYS-05** Animate and show events | Update to the returned state; step-by-step animation when on; message for events like capture. | POST-05-1: final board = accepted state. POST-05-2: animation off gives the same result. EXC-05-1: no event → **don't invent one.** |
| **FR-SYS-06** Progress and completion | Per player: pieces in **base / on track / at home**. Winner screen on completion. | POST-06-2: winner screen only on a completion response. POST-06-3: ranking and session score **never fabricated**. EXC-06-1: never compute a winner. |
| **FR-SYS-07** Computer moves | AI seat: get a move from game AI, submit to game logic, show result. | POST-07-1: AI move validated before shown. POST-07-2: AI failure doesn't corrupt state. |
| **FR-SYS-08** Restart, exit, rematch | Restart, leave, new game after completion. | **Confirm before discarding progress.** POST-08-1: cancel = unchanged. POST-08-3: failed request doesn't erase state. |
| **FR-SYS-09** One-screen game view | Board, bases, track, centre, pieces, dice, active player, progress, **message area** — all on one screen. | ALT-09-1: small window → adapt layout without hiding essential status. |
| **FR-SYS-10** Sound, animation, theme | Sound on/off; skip or disable animation; **light and dark theme**. | POST-10-2: animation setting never changes outcomes. POST-10-3: theme switch keeps game state. ALT-10-1: persistence TO CONFIRM. |

Also from D2, folded into the above:
- **FR-07** rules summary before **and** during the game
- **FR-29** session score across rematches (TO CONFIRM)
- **FR-34** confirmation before leaving or restarting
- **FR-36** last-action message, e.g. "Hifza rolled 4 and captured a piece"

---

## 4. Non-functional requirements (D3 §5)

| ID | Requirement | How we prove it |
|---|---|---|
| NFR-SYS-01 | Visible acknowledgement of any action within 1 s. | Every button shows a pressed/pending state at once. Measure with the Performance panel. |
| NFR-SYS-02 | Computer move within 2 s. | Server `aiDelayMs` default 700 ms. Log request-to-event times in dev. |
| NFR-SYS-03 | No crash in normal play. | Error boundary around each screen. Repeated end-to-end runs. |
| NFR-SYS-04 | Invalid input never loses state. | Store tests: rejected command leaves snapshot unchanged. |
| NFR-SYS-05 | Display the server's dice value; never bias, alter or substitute it. | Test: rendered face equals `turn.lastRoll`. No `Math.random` near the dice. |
| NFR-SYS-06 | First-time player completes a first turn without help. | Rules summary + highlighted pieces + friendly copy. Do a 5-minute test with someone who hasn't seen the app. |
| NFR-SYS-07 | Readable; **player identity not by colour alone** — label, shape or other cue. | Each colour gets a letter and a shape. Check in grayscale (DevTools → Rendering → emulate vision deficiency). |
| NFR-SYS-08 | Short, simple wording; **full keyboard play** (setup, roll, select, move, controls). | Play a whole game with no mouse. |
| NFR-SYS-09 | Latest Chrome, Firefox, Edge on desktop, no install. | Smoke test in all three. |
| NFR-SYS-10 | Adapts to desktop window sizes. Mobile TO CONFIRM. | Resize 1024–1920 px wide; nothing essential hidden. |
| NFR-SYS-11 | Rules and settings come from config or a rules interface, **not hard-coded in presentation components.** | Board geometry lives in `src/config/`; rule values come from `snapshot.rules`; rules text is generated from them. |
| NFR-SYS-12 | Reach game logic and AI **only through defined interfaces**, replaceable without redesigning the UI. | `GameAdapter` interface in `src/adapter/`. Store tests run against a fake adapter. |
| NFR-SYS-13 | Structured, commented code all three members can modify. | Folder layout in `CLAUDE.md`; PR reviews. |
| NFR-SYS-14 | No database or server storage for normal play; current state in memory; small display prefs on device if confirmed. | Only `settingsStore` touches `localStorage`. |

---

## 5. Where our D3 and the backend server disagree

These need a decision from the client (teacher/TA) or the backend team.
**Do not silently pick one in code.** Until decided, the column "Kit does" is
the default.

| Topic | Our D3 says | Backend LGS does | Kit does |
|---|---|---|---|
| **Networking** | §1.1 excludes remote multiplayer; §3.2 says client-server is not needed, but the adapter "can later be … a network API". | Socket.IO server with rooms and join codes. | Treat the LGS socket as **one implementation of our adapter**. This matches D3 §3.2. Lobby/room codes go beyond D2 — note it in a D3 v1.2 changelog. |
| **Same-device play** (Rida; FR-03) | HvH, friends on one device. | One session per player; each human joins separately. | Network play first. Local multi-seat (one browser holds several seats) is task P13, **TO CONFIRM**. |
| **Pick a colour** (FR-06, FR-SYS-01) | Each seat picks a colour. | Seat 1 is always red; colours follow seats. No colour field in create/join. | Ask backend. Until then, choosing a seat = choosing a colour; show it clearly. |
| **Who runs the AI** (FR-SYS-07) | Front end passes state to game AI, then submits the choice. | Server runs AI itself. | Allowed by D3 §3.3 ("or the agreed orchestration layer"). We show "Computer is thinking…" and render the result. |
| **Extra turns** (R5) | Only on a 6. | Also on a capture and on finishing a piece (configurable). | Server wins. Rules summary is **generated from `snapshot.rules`**, so it always matches what the server does. |
| **Final ranking** (R11, FR-28) | Not produced. | `ranking` sent at game end. | Show ranking only if the server sends it (POST-06-3). |
| **Settings persistence** (ALT-10-1) | TO CONFIRM. | n/a | `localStorage`, behind one flag so it can be switched off. |
| **Mobile** (NFR-SYS-10) | TO CONFIRM; desktop required. | n/a | Desktop-first. Must not break at narrow widths, but phone polish is not MVP. |
| **Theme** (FR-39) | Light **and** dark. | n/a | Both are MVP. The mockups are dark; dark is default. |

Also from D3 §6.3 open decisions: first-player rule, no-move message, exact
roll, capture/safe squares, session score, AI difficulty, browser versions.
Most are already answered by the backend's rules — **write those answers into
D3 v1.2** so the documents agree.

Small fix for your D3: §6.3 still says "Add the group contact e-mail in
Section 1.3", but §1.3 already has it. Tick it off.
