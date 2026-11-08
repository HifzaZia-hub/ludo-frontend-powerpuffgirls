# 02 — Board Model and Geometry

This is **layout maths only**. It converts a server-sent `step` number into a
cell on screen. It contains no game rules and makes no decisions.

All constants here go in `src/config/board.ts`, not inside components. That is
how we meet NFR-SYS-11 (board and rules come from configuration, not from
presentation code).

Sources: backend D3 §2.2 and Figure 1; our D3 §2.2 rules R1–R11.

---

## 1. The step scale

Every piece has one number: `step`.

| `step` | Meaning |
|---|---|
| `0` | in the yard |
| `1`–`51` | on the shared main track |
| `52`–`56` | in its own home column (5 squares) |
| `57` | home (finished, never moves again) |

Main-track square from a step:

```
square = (startSquare + step - 1) mod 52      // only valid for step 1..51
```

| Colour | `startSquare` | step 1 is square | step 51 is square |
|---|---|---|---|
| RED | 0 | 0 | 50 |
| GREEN | 13 | 13 | 11 |
| YELLOW | 26 | 26 | 24 |
| BLUE | 39 | 39 | 37 |

Safe squares (no capture possible): **0, 8, 13, 21, 26, 34, 39, 47**
— the four start squares plus the four stars. This list is also in
`rules.safeSquares`; read it from the snapshot, do not hard-code it, because
the host can override it.

---

## 2. The 15×15 grid

Cells are `[col, row]`, zero-indexed, origin **top-left**.

Yards (6×6 blocks):

| Colour | Yard block origin |
|---|---|
| RED | cols 0–5, rows 0–5 (top-left) |
| GREEN | cols 9–14, rows 0–5 (top-right) |
| YELLOW | cols 9–14, rows 9–14 (bottom-right) |
| BLUE | cols 0–5, rows 9–14 (bottom-left) |

Clockwise colour order is RED → GREEN → YELLOW → BLUE, which matches
top-left → top-right → bottom-right → bottom-left.

Centre home = cell `[7, 7]`.

### The 52 main-track cells, in square order

Verified: 52 unique cells, no overlap with any home column or the centre, and
each colour's step-51 square sits next to its own home-column entry.

```ts
// index = main-track square number (0..51)
export const TRACK_CELLS: ReadonlyArray<readonly [number, number]> = [
  [1,6], [2,6], [3,6], [4,6],    // 0-3
  [5,6], [6,5], [6,4], [6,3],    // 4-7
  [6,2], [6,1], [6,0], [7,0],    // 8-11
  [8,0], [8,1], [8,2], [8,3],    // 12-15
  [8,4], [8,5], [9,6], [10,6],   // 16-19
  [11,6],[12,6],[13,6],[14,6],   // 20-23
  [14,7],[14,8],[13,8],[12,8],   // 24-27
  [11,8],[10,8],[9,8], [8,9],    // 28-31
  [8,10],[8,11],[8,12],[8,13],   // 32-35
  [8,14],[7,14],[6,14],[6,13],   // 36-39
  [6,12],[6,11],[6,10],[6,9],    // 40-43
  [5,8], [4,8], [3,8], [2,8],    // 44-47
  [1,8], [0,8], [0,7], [0,6],    // 48-51
] as const;
```

### Home columns (steps 52 → 56, in travel order)

```ts
export const HOME_COLUMN_CELLS: Record<Colour, ReadonlyArray<readonly [number, number]>> = {
  RED:    [[1,7], [2,7], [3,7], [4,7], [5,7]],      // enters from the left
  GREEN:  [[7,1], [7,2], [7,3], [7,4], [7,5]],      // enters from the top
  YELLOW: [[13,7],[12,7],[11,7],[10,7],[9,7]],      // enters from the right
  BLUE:   [[7,13],[7,12],[7,11],[7,10],[7,9]],      // enters from the bottom
};
```

### Yard slots

Four circles inside each 6×6 yard block. Using fractional cell centres
relative to the yard origin `(ox, oy)`:

```
slot 0: (ox + 1.5, oy + 1.5)
slot 1: (ox + 4.5, oy + 1.5)
slot 2: (ox + 1.5, oy + 4.5)
slot 3: (ox + 4.5, oy + 4.5)
```

Piece `R1` uses slot 0, `R2` slot 1, `R3` slot 2, `R4` slot 3 — parse the digit
from the piece ID so a captured piece always returns to the same visual slot.

---

## 3. The one function you need

```ts
import type { Colour, Piece } from "@/contract/types";

const START_SQUARE: Record<Colour, number> = { RED: 0, GREEN: 13, YELLOW: 26, BLUE: 39 };
const YARD_ORIGIN:  Record<Colour, readonly [number, number]> =
  { RED: [0,0], GREEN: [9,0], YELLOW: [9,9], BLUE: [0,9] };
const YARD_SLOTS = [[1.5,1.5], [4.5,1.5], [1.5,4.5], [4.5,4.5]] as const;

/** Centre of the cell a piece sits on, in grid units (0..15). Pure. */
export function pieceCell(piece: Piece): { col: number; row: number } {
  const { colour, step, id } = piece;

  if (step === 0) {
    const [ox, oy] = YARD_ORIGIN[colour];
    const slot = YARD_SLOTS[Number(id.slice(1)) - 1];
    return { col: ox + slot[0], row: oy + slot[1] };
  }

  if (step === 57) return { col: 7.5, row: 7.5 };          // centre home

  if (step >= 52) {
    const [c, r] = HOME_COLUMN_CELLS[colour][step - 52];
    return { col: c + 0.5, row: r + 0.5 };
  }

  const square = (START_SQUARE[colour] + step - 1) % 52;   // step 1..51
  const [c, r] = TRACK_CELLS[square];
  return { col: c + 0.5, row: r + 0.5 };
}
```

Add `+ 0.5` so the result is a cell **centre**, which is what you want for
`transform: translate(...)` and for a 3D mesh position.

To render: one absolutely-positioned layer over the board, each piece placed at
`left: (col / 15) * 100%`, `top: (row / 15) * 100%`, with
`transform: translate(-50%, -50%)`. Animate `left`/`top` with Framer Motion's
`layout` or an explicit `animate` — never re-mount the piece, or it teleports.

---

## 4. Animating a move along the path

The server tells you `fromStep` and `toStep`. A piece should walk the squares
between them, not slide diagonally across the board.

```ts
/** The steps a piece passes through, inclusive of the destination. Pure. */
export function pathSteps(fromStep: number, toStep: number): number[] {
  if (fromStep === 0) return [1];            // leaving the yard is one hop
  const out: number[] = [];
  for (let s = fromStep + 1; s <= toStep; s++) out.push(s);
  return out;
}
```

Animate ~120 ms per step, then settle. A roll of 6 therefore takes ~720 ms,
which feels right and matches the server's 700 ms AI pause.

If `prefers-reduced-motion` is set, jump straight to the final cell.

---

## 5. Stacking

Several pieces can share one cell:
- own pieces may always stack
- different colours may share a **safe** square

When `n > 1` pieces occupy the same cell, fan them out: offset each by
`±0.18` cell units on a small arc and scale each to `1 - 0.08 * (n - 1)`.
Show a small count badge when `n >= 3`.

---

## 6. Progress counts for the status panel (FR-SYS-06)

D2 FR-26 asks for each player's pieces **in base, on the track, and at home**.
This is counting what the snapshot already says — display, not rules:

```ts
/** Pure. Counts a player's pieces by where they are. */
export function progressCounts(pieces: Piece[], colour: Colour) {
  const mine = pieces.filter((p) => p.colour === colour);
  return {
    base:  mine.filter((p) => p.step === 0).length,
    track: mine.filter((p) => p.step >= 1 && p.step <= 56).length, // home column counts as track
    home:  mine.filter((p) => p.step === 57).length,
  };
}
```

Cross-check `home` against `player.piecesHome` from the server in a dev-only
assertion. If they ever differ, the server is right and our step mapping is
wrong.

---

## 7. Rules the UI must *display* but never *enforce*

The server enforces every one of these. We list them so the UI can explain
what just happened. "Our D3" is the rule number in our own spec; "LGS" is the
backend's.

| Our D3 | LGS | Rule | What the player sees |
|---|---|---|---|
| R3 | G-4 | Leave the base only on a 6 | base pieces are dimmed unless the server listed them as legal |
| R10 | G-6 | Exact roll to finish | an overshooting piece is simply not in `legalMoves` |
| R7, R8 | G-7 | Capture, except on safe squares | safe squares show a star/shield **and** a text label for screen readers |
| R5 | G-8 | Extra turn — our D3 says on a 6; LGS also on capture/finish | "Roll again!" banner. Rules text comes from `snapshot.rules` |
| R5 | G-9 | Three 6s lose the turn | a sixes counter 0/1/2 |
| R6 | G-10 | No legal move → turn skipped | show the roll ~1 s, then "No move possible — turn skipped" |
| — | G-12 | Turn timer (30 s default) | countdown ring; "Time's up — the computer played for you" |
| — | G-13 | Disconnect → AI stand-in | "Computer is playing for <name>" badge |
| R11 | G-11 | Winner | winner screen only on `GAME_OVER`; ranking only if sent |

**We display these. We never decide them.** If `legalMoves` is empty, we show
"no moves" — we do not check why.

### Rules summary text (D2 FR-07)

The in-game rules summary must be **built from `snapshot.rules`**, so it never
disagrees with what the server does. Example: if `bonusOnCapture` is true, the
summary includes "Capturing a piece gives you another turn." Before a game
starts (main screen), build it from the LGS defaults in
`src/config/defaultRules.ts` and label it "Standard rules".
