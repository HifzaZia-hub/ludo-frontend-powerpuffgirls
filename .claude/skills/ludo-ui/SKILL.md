---
name: ludo-ui
description: Visual and interaction rules for any Ludo front-end screen or component — main screen, setup, lobby, board, status panel, message area, dice, move picker, capture feedback, win screen, settings, rules summary, confirm dialogs, themes, keyboard, wording. Use whenever a task creates or edits src/components, src/screens, src/interaction, src/feedback or src/styles, or mentions Tailwind, Framer Motion, layout, light/dark theme, accessibility, keyboard, or message text.
---

# Ludo UI rules

Read `docs/03-ui-spec.md` for tokens, screens, keyboard map, message
templates and friendly copy. Requirement IDs refer to
`docs/00-requirements.md`.

## Non-negotiables (from our D3)

1. **Both themes.** Dark default, light required (FR-SYS-10). Colours only
   from CSS variables. A raw hex in a component is a bug.
2. **Not colour alone** (NFR-SYS-07). Every player mark shows colour **and**
   shape **and** letter, from `src/config/players.ts`. Messages use names.
3. **Keyboard everything** (NFR-SYS-08). Real `<button>`s. The keyboard map
   in the UI spec §5 works on every screen. Visible focus ring
   (`--focus-ring`). Never `outline: none` without a replacement.
4. **Simple words** (NFR-SYS-08). All player-facing text comes from
   `src/feedback/copy.ts` or the message templates. Write for a 12-year-old.
   No codes, no jargon, no blame.
5. **Instant acknowledgement** (NFR-SYS-01). Every control shows pressed or
   pending state immediately.
6. **One screen** (FR-SYS-09). Board, dice, turn, status panel and message
   area are all visible in the game screen at 1280×720 without scrolling.
7. **Confirm before losing progress** (FR-SYS-08). Restart and Leave go
   through `ConfirmDialog`; Cancel has default focus.
8. **Animations never change outcomes** (POST-05-2, POST-10-2). With
   animation off, render the final state immediately. A Skip control is
   available during any animation.
9. **Reduced motion.** `useReducedMotion()` or setting Off → duration 0.
10. **No layout shift.** Reserve space for banners, toasts and the countdown.

## Component shape

```tsx
interface DiceProps {
  value: number | null;   // always the server's turn.lastRoll
  rolling: boolean;
  disabled: boolean;
  onRoll: () => void;
}

export function Dice({ value, rolling, disabled, onRoll }: DiceProps) { … }
```

- Presentational components take props and call callbacks. They never import
  the store or the adapter.
- Screens are the only place that reads the store.
- Keyboard handling lives in `src/interaction/`, not scattered in components.

## Animation budget

| Thing | Duration (On) | Fast | Off |
|---|---|---|---|
| screen transition | 250 ms | 120 ms | 0 |
| dice tumble | 600 ms, land on server value | 250 ms | 0 |
| piece walk | 120 ms per square | 50 ms | 0 |
| capture flash + return | 150 + 400 ms | 60 + 150 ms | 0 |
| button press | 80 ms | 80 ms | 0 |

Hamza (D2) finds long animations annoying. Nothing except the turn pulse runs
longer than a second.

## Board

- Square, as large as fits next to the side panels.
- 15×15 CSS grid; pieces on one absolutely-positioned layer placed from
  `pieceCell()`. Key by `piece.id`.
- Safe squares: star icon **plus** an accessible label.
- Pieces are buttons with labels like "Red piece 3, on the track, can move to
  the home column".

## Accessibility check before saying "done"

- Tab through the screen: is the order sensible? Is focus always visible?
- Play the feature with the keyboard only.
- Turn on grayscale emulation: can you still tell players apart?
- Switch to light theme: is everything still readable?

## What to skip when short on time

3D, extra board themes, music, confetti, vibration, avatar art. None are in
our D2/D3. Light theme, keyboard play and the status panel **are**.
