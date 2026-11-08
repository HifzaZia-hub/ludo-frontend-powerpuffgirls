# NFR-SYS-08: kitchen sink checks in a real browser

Checked on 2026-11-08, on branch `feat/p4-design-system`, in headless Microsoft Edge at
`?kitchen=1`, using real key presses. jsdom has no real modal dialogs, so these could not be unit
tests. The console showed no errors or warnings during the run.

## Keyboard (NFR-SYS-08)

| Check | Result |
|---|---|
| `SegmentedControl`: arrow keys move the choice and wrap round | Pass |
| Arrow keys keep focus on the option | Pass |
| Focus ring after Tab | `solid 2px` |
| `Toggle`: Space flips it, Enter flips it back | Pass |

## Modal and ConfirmDialog (FR-SYS-08)

| Check | Result |
|---|---|
| Opens as a true modal (`:modal`), centred | Pass |
| Focus moves inside when it opens | Pass |
| 12 Tab presses never reach the page behind | 0 escapes |
| Esc closes it, and focus returns to the opener | Pass |
| `ConfirmDialog`: Cancel has focus first | Pass |
| Esc cancels, and Enter on the first focus cancels | Pass |
| Tab then Enter on the danger button confirms | Pass |

## Instant feedback and motion (NFR-SYS-01, FR-SYS-10)

| Check | Result |
|---|---|
| Pressing the die shows "Rolling…" at once | Pass |
| Tumble length on On / Fast / Off | `0.6s` / `0.25s` / `0s` |
| Button spinner and transitions on Off | `0s` |
| Tumble with the device's reduced-motion setting | `0s` |

## Contrast (docs/03-ui-spec.md §2)

42 colour pairs were measured from `src/styles/theme.css`, in both themes, against 4.5:1 for text
and 3:1 for marks and focus rings. None are below target. Before P4 the spec's own values failed on
the light-theme primary button (3.08:1), `--text-low` on panels and light-theme `--p-yellow` (2.27:1),
and no text colour worked on `--danger` in both themes.

## Not covered here

- Only Edge was used. Chrome and Firefox are for P12.
- These are the components on their own. Playing a whole game by keyboard needs P8.
