# P4 — Design system components

**Implements:** NFR-SYS-07 (not colour alone), NFR-SYS-08 (keyboard, simple
words), NFR-SYS-01 (instant feedback), groundwork for FR-SYS-08/09/10
**Read first:** `docs/03-ui-spec.md` (all), the `ludo-ui` skill

Build the shared components. No screens, no store, no adapter. Props in,
callbacks out.

## Components

| Component | Notes |
|---|---|
| `Button` | primary / outline / ghost / danger; sm / md / lg; `pending` state shows a spinner **instantly** (NFR-SYS-01); scale 0.97 on press |
| `Card` | `--bg-panel`, 1px border, `rounded-2xl`, optional `active` ring |
| `PlayerMark` | colour **+ shape + letter** from `src/config/players.ts`. Every other component uses this to show a player. |
| `PlayerCard` | for the status panel: mark, name, tag ("you" / "Computer" / "Offline — computer playing"), and **Base · Track · Home** counts; `active` variant lifts and rings |
| `Piece` | one token with its shape glyph on top; states `idle / movable / selected / dimmed`; a `<button>` when movable, with an `aria-label` |
| `Dice` | `{ value, rolling, disabled, onRoll }`. Tumbles while `rolling`; lands on `value` — **never** a random face |
| `CountdownRing` | SVG; amber < 10 s, red < 5 s; driven by a 1 s interval, not re-rendering the tree |
| `SegmentedControl` | arrow keys move the selection |
| `Toggle`, `TextField` (with error slot that keeps the typed value) | |
| `Modal` | focus trap, Esc closes, returns focus to the opener |
| `ConfirmDialog` | from `03-ui-spec.md` §4: title, body, **Cancel** (default focus) + danger action (FR-SYS-08) |
| `Toast` + `ToastRegion` | `aria-live="polite"`; errors stay until dismissed |
| `MessageLog` | latest line large, previous 5–8 smaller; `aria-live="polite"` (FR-SYS-05) |
| `RulesSummary` | takes a `RuleConfig` and renders 6–8 short lines built from it (D2 FR-07, NFR-SYS-11). Include the keyboard table. |
| `ThemeToggle` | Dark / Light |

Put all player-facing strings in `src/feedback/copy.ts` (create it now with
the error table from `03-ui-spec.md` §7 and the message templates from §6).

## Requirements for every component
- Props interface above, named export, one file each.
- Tokens only. Grep your output for `#[0-9a-fA-F]{3,6}` in `src/components`
  — zero hits.
- Keyboard reachable with a visible focus ring.
- `useReducedMotion()` collapses animation.
- No import from `src/store` or `src/adapter`.

## Tests
- `RulesSummary`: with `bonusOnCapture: false`, the capture-bonus line is
  absent; with `true`, present.
- `Dice`: after `rolling` → false, the visible face equals `value`.
- `ConfirmDialog`: Esc and Cancel call `onCancel` and not `onConfirm`.

## Kitchen sink
`src/screens/KitchenSink.tsx` shows every component in every state, with a
theme switch at the top. Reachable via `?kitchen=1` in dev only.

## Done when
Kitchen sink renders everything in **both** themes. Take a grayscale
screenshot of the `PlayerMark` row and save it as
`docs/evidence/NFR-SYS-07-player-marks.png`. Tests, typecheck and lint pass.
