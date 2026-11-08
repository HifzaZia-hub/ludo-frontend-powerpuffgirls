# 03 — UI Specification

Based on the 10-screen mockup sheet **and** our D2/D3 requirements. Where they
disagree, the requirements win — the mockups are a style guide, not a spec.

---

## 1. Visual direction

Soft rounded cards, one bright mint call-to-action per screen, four saturated
player colours. **Dark theme is the default** (it matches the mockups).
**Light theme is required too** (FR-SYS-10, D2 FR-39) — it is MVP, not polish.

Desktop first (NFR-SYS-09/10). Must stay usable down to ~360 px wide, but
phone polish waits until mobile support is confirmed.

---

## 2. Design tokens

`src/styles/theme.css`. Dark on `:root`, light on `html[data-theme="light"]`.
Tailwind reads these through `theme.extend.colors`, so a theme switch is one
attribute on `<html>` and zero component changes.

```css
:root, html[data-theme="dark"] {
  --bg-deep:     #060B18;
  --bg-panel:    #0C1627;
  --bg-raised:   #142238;
  --border-soft: #1E3050;
  --focus-ring:  #5AA9FF;
  --text-high:   #F2F6FF;
  --text-mid:    #9DB0CE;
  --text-low:    #6B7E9C;
  --accent:      #2DD98A;
  --accent-press:#1FB874;
  --on-accent:   #04220F;
  --danger:      #F05252;
  --warning:     #F5A524;
  --board-cell:  #F4F6FA;
  --board-line:  #C9D2E0;
  --p-red:    #E8413F;
  --p-green:  #2BBF5B;
  --p-yellow: #F4C026;
  --p-blue:   #2F7DF6;
}

html[data-theme="light"] {
  --bg-deep:     #EEF2F8;
  --bg-panel:    #FFFFFF;
  --bg-raised:   #F3F6FB;
  --border-soft: #D5DDEA;
  --focus-ring:  #1D5FD1;
  --text-high:   #0E1726;
  --text-mid:    #46556E;
  --text-low:    #6A7891;
  --accent:      #13A866;
  --accent-press:#0E8A53;
  --on-accent:   #FFFFFF;
  --danger:      #C9302C;
  --warning:     #B76E00;
  --board-cell:  #FFFFFF;
  --board-line:  #B7C2D3;
  --p-red:    #D7322F;
  --p-green:  #1E9E48;
  --p-yellow: #D9A400;
  --p-blue:   #2367D8;
}
```

Check both themes for text contrast (aim for 4.5:1 on body text) before
calling P4 done.

Radii: cards `rounded-2xl`, buttons `rounded-full`, chips `rounded-lg`.
Type: one sans family (Inter or system stack). Display 32/700, heading 20/600,
body 15/400, label 12/600 uppercase.

Extra themes from the mockup (Dark Neon, Forest, Minimal) are **polish**
(P14). Each is just another block of the same variables.

---

## 3. Player identity — not colour alone (NFR-SYS-07)

Every colour has a letter and a shape. Show the shape on the piece, the colour
dot, the player chip and the status panel.

| Colour | Letter | Shape |
|---|---|---|
| Red | R | ● circle |
| Green | G | ▲ triangle |
| Yellow | Y | ■ square |
| Blue | B | ◆ diamond |

Put this mapping in `src/config/players.ts` — one place only. Test it: view the
board with DevTools → Rendering → "Emulate vision deficiencies → Achromatopsia".
You must still be able to tell every player apart.

---

## 4. Screens

Routing is one `screen` value in `uiStore`: `"main" | "setup" | "lobby" |
"game" | "win"`. Settings, Rules and Confirm are modals. No router library.

### S1 — Main screen (FR-SYS-01 trigger, D2 FR-01, FR-07)
- "LUDO" wordmark, tagline "Roll · Move · Capture · Win".
- **New Game** (primary) → Setup.
- **Join Game** (outline) → code entry.
- **How to play** (ghost) → Rules summary modal. *Before the game* (FR-07).
- **Settings** (gear).
- Static background only. This screen must paint instantly.

### S2 — Setup (FR-SYS-01)
- **Players:** 2 / 3 / 4 (segmented control).
- **Mode:** "Play with friends" (HvH) / "Play with computer" (HvC).
- **Your name** (and **your colour** — see note).
- Computer difficulty: Easy / Normal (HvC only).
- **Start** → `POST /api/v1/rooms`.
- On a rejected or failed request, **keep everything the player typed**
  (ALT-01-1, EXC-01-1). Show the error next to the field it is about.

> **Colour choice note.** FR-06 wants each player to pick a colour. The LGS
> today gives seat 1 red and fills colours by seat. Until the backend answers
> (open question in `01-contract.md`), show the assigned colour clearly with
> its shape and letter, and leave a slot in the form for the picker.

### S3 — Lobby (beyond D2; needed by the LGS)
- Room code shown big, with **Copy**. This is what people need from this screen.
- Seat list from `RoomSnapshot.seats`: shape+colour, name, "Computer" badge,
  host crown. Empty seat: host sees **Add computer player**, others see
  "Waiting for a player…".
- **Start game** — host only. Non-hosts see "Waiting for <host> to start".
- **Leave** → confirm dialog.

### S4 — Game screen (FR-SYS-09: everything on one screen)

Desktop layout (≥ 1024 px):

```
┌──────────────────────────────────────────────────────────────┐
│ ☰ Menu   ? Rules        Turn: ● Red — Rida (you)   ⚙  🔊    │  top bar
├───────────────┬───────────────────────────────┬──────────────┤
│ STATUS PANEL  │                               │ DICE         │
│ ● Rida  you   │                               │ [ 🎲 ]       │
│  base 2       │           BOARD               │ Tap to roll  │
│  track 1      │        (square, 15×15)        │ ◦◦◦ sixes    │
│  home 1       │                               │ ⏱ 24s        │
│ ▲ Comp. (AI)  │                               ├──────────────┤
│  …            │                               │ MESSAGES     │
│               │                               │ Rida rolled 6│
│               │                               │ Rida moved…  │
└───────────────┴───────────────────────────────┴──────────────┘
```

Under ~1024 px: board on top, then dice + status in one row, then messages.
Nothing essential may be hidden (ALT-09-1).

**Board** — see `docs/02-board-model.md`. Square, as large as fits.

**Status panel** (FR-SYS-06, D2 FR-26) — one card per player:
shape+colour, name, "(you)" / "Computer" / "Offline — computer playing",
and three counts: **Base · Track · Home** from `progressCounts()`.
The active player's card is lifted with a ring.

**Turn indicator** (FR-SYS-02) — text, not just colour:
"Your turn — roll the dice", "Hamza's turn", "Computer is thinking…".

**Dice** (FR-SYS-02, NFR-SYS-05) — big button, "Roll" label.
Enabled only when the selector says I may roll. Shows the server's value,
never a random one. Disabled while a roll is pending (EXC-02-1).

**Message area** (FR-SYS-05, D2 FR-36) — the last action in large text plus
the previous 5–8 below it. Built **only** from server events (EXC-05-1).
`aria-live="polite"` so screen readers announce it. Templates in §6.

**Menu** — Restart (host), Leave game, Settings, Rules. Restart and Leave go
through the confirm dialog.

### S5 — Move choice (FR-SYS-03)
- After a roll, movable pieces glow and become buttons; others are dimmed.
- Select a piece (click, or keyboard) → its **destination** gets a ghost
  marker (FR-18), and any piece it would capture gets a red ring.
- Select again, or press **Move**, to confirm.
- A side panel lists the movable pieces as cards too ("Piece 2 → home
  column"), for players who find the board fiddly.
- No movable piece: the server skips the turn; show "No move possible —
  turn skipped" (R6). Never show an empty chooser.

### S6 — Capture, finish, extra turn (FR-SYS-05)
- Capture: flash, shake, piece flies back to its base; message "Rida captured
  Hamza's piece!".
- Finish: piece rises into the centre; "Rida got a piece home!".
- Extra turn: "Roll again!" banner.
- All of these collapse to an instant change when animation is off.

### S7 — Win screen (FR-SYS-06, FR-SYS-08)
- Shown **only** on `GAME_OVER` (POST-06-2). "<Name> wins!" with a crown.
- Ranking of the others **only if** the server sent `ranking` (POST-06-3).
- Session score across rematches (FR-29, TO CONFIRM): a small tally of wins
  per player, counted from server-reported winners only, reset when you leave
  the room.
- **Play again** (host) · **New game** · **Main menu**.
- Optional: "Check the dice were fair" (seed reveal) — see P10.

### Settings modal (FR-SYS-10)

MVP (required by D2/D3):

| Setting | Values | Notes |
|---|---|---|
| Sound effects | On / Off | FR-37 |
| Animations | On / Fast / Off | FR-38. A **Skip** button also appears during any animation. |
| Theme | Dark / Light | FR-39 |

Polish (P14): extra board themes, 3D pieces, music, vibration.

Changing any setting never changes game state (POST-10-2, POST-10-3).
Persistence: `localStorage` by default, behind `PERSIST_SETTINGS` in
`src/config/app.ts` because ALT-10-1 is TO CONFIRM.

### Rules summary modal (D2 FR-07, NFR-SYS-06)
- 6–8 short lines, one idea per line, with a small picture where it helps.
- Built from `rules` (in game) or `defaultRules` (main screen) — see
  `02-board-model.md` §7.
- Reachable from the main screen **and** from the game screen's `?` button.

### Confirm dialog (FR-SYS-08, D2 FR-34)
- Title says what will happen: "Leave this game?" / "Restart the game?"
- Body: "Your progress in this game will be lost."
- Buttons: **Cancel** (default focus) and **Leave** / **Restart** (danger).
- Escape = Cancel. Cancel leaves everything unchanged (POST-08-1).

---

## 5. Keyboard map (NFR-SYS-08)

| Key | Action |
|---|---|
| `Tab` / `Shift+Tab` | move between controls |
| `Enter` / `Space` | activate the focused control |
| `R` | roll (when allowed) |
| `1`–`4` | select your piece 1–4 (only if movable) |
| `Enter` | confirm the selected move |
| `Esc` | close modal / cancel selection |
| `?` | open rules summary |
| `S` | skip the current animation |

Show these in the rules modal under "Keyboard". Never steal keys while the
player is typing in a text field.

---

## 6. Message templates (FR-36)

Use player **names**, not colours, so the text works for colour-blind players.

| Event | Message |
|---|---|
| `GAME_STARTED` | "Game started. <Name> goes first." |
| `ROLLED` | "<Name> rolled <n>." |
| `MOVED` | "<Name> moved a piece <n> squares." |
| `MOVED` out of base | "<Name> brought a piece out." |
| `CAPTURED` | "<Name> captured <Other>'s piece!" |
| `PIECE_FINISHED` | "<Name> got a piece home!" |
| `BONUS_TURN` | "<Name> rolls again!" |
| `TURN_PASSED` | "<Name> can't move. Turn skipped." |
| `TURN_FORFEITED` | "Three 6s in a row — <Name>'s turn is over." |
| `PLAYER_DISCONNECTED` | "<Name> left. The computer will play for them." |
| `PLAYER_RECONNECTED` | "<Name> is back." |
| `GAME_OVER` | "<Name> wins!" |

Combine a roll and its result into one line when they come together:
"Hifza rolled 4 and captured a piece" (the D2 example).

---

## 7. Friendly copy for errors (FR-SYS-04, NFR-SYS-08, Maryam)

Short. No blame. Say what to do next.

| Code | What the player sees |
|---|---|
| `ILLEGAL_MOVE` | *the server's own reason* (it is specific) |
| `NOT_YOUR_TURN` | "Wait for your turn." |
| `ROLL_REQUIRED` | "Roll the dice first." |
| `ALREADY_ROLLED` | "You already rolled. Pick a piece to move." |
| `INVALID_NAME` | "Use 1–20 letters or numbers for your name." |
| `NAME_TAKEN` | "Someone in this game already has that name. Try another." |
| `INVALID_CODE` | "That code doesn't look right. It has 6 letters and numbers." |
| `ROOM_NOT_FOUND` | "We couldn't find that game. Check the code." |
| `ROOM_FULL` | "That game is full." |
| `GAME_ALREADY_STARTED` | "That game has already started." |
| `NOT_ENOUGH_PLAYERS` | "You need at least 2 players. Add a computer player?" |
| `RATE_LIMITED` | "Slow down a little and try again." |
| `SERVER_BUSY` | "The game server is busy. Try again in a minute." |
| `UNAUTHORIZED` | "Your game session ended. Please start again." |
| `INTERNAL_ERROR` | "Something went wrong. Your game is safe — try again." |
| anything else | `error.message`, or "That didn't work. Try again." |

Keep this table in `src/feedback/copy.ts`, not scattered through components.

---

## 8. Shared components (build once, in P4)

`Button` (primary/outline/ghost/danger), `Card`, `Avatar`, `PlayerMark`
(shape + letter + colour), `PlayerCard` (status panel entry), `Piece`,
`Dice`, `CountdownRing`, `SegmentedControl`, `Toggle`, `TextField`, `Modal`,
`ConfirmDialog`, `Toast`/`ToastRegion`, `MessageLog`, `RulesSummary`,
`ThemeToggle`.

## 9. States every screen handles

Loading (skeleton, no blank flash) · Empty ("Share the code to invite
friends") · Error (friendly copy) · Disconnected (sticky "Reconnecting…"
banner, board stays visible) · Computer-playing-for-you.
