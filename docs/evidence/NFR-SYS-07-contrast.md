# Readable in both themes, and not by colour alone (NFR-SYS-07)

## Grayscale, both themes

Taken on 2026-11-15 with `npm run e2e -- grayscale --save` in Chrome 157, with DevTools' vision
emulation set to achromatopsia (no colour at all):

- `NFR-SYS-07-game-dark.png` and `NFR-SYS-07-game-light.png`: the board and the status panel, with a
  move waiting to be picked.
- `NFR-SYS-07-win-dark.png` and `NFR-SYS-07-win-light.png`: the win screen with its final places.

In all four, every player is still told apart by a letter (R, G, Y, B) and a shape (circle,
triangle, square, diamond): on the pieces, the home columns, the player cards and the final places.
Grayscale shots from earlier tasks cover the player marks, move highlights and capture preview
(`NFR-SYS-07-player-marks.png`, `-move-highlights-grayscale.png`, `-capture-grayscale.png`). They were
taken on the code of their time and weren't taken again.

## Text contrast on every screen (the light-theme walk)

Run on 2026-11-15 with `npm run e2e -- contrast` in Chrome 157. On each screen and dialog, the script
worked out the contrast of every piece of text against the colour behind it, and compared it with
WCAG 2.1 AA: 4.5:1 for normal text, 3:1 for large text. Disabled controls are exempt.

Screens and dialogs checked, in both themes: main, Settings, How to play, Join, setup, waiting room,
the game with a move waiting, the game menu, the restart question, Rules, and the win screen.

| Theme | Texts checked | Below the target | Closest to the target |
|---|---|---|---|
| Dark | 425 | **0** | "Restart" in the restart question, 5.38:1 |
| Light | 421 | **0** | "Restart" in the restart question, 5.33:1 |

Next closest in both: the "Base" and "Track" labels on the player cards (6.05:1 dark, 5.48:1 light).

To be sure the checker isn't passing everything, it first measures a grey-on-grey probe, which must
fail. It did: 1.26:1.

Nothing needed fixing.

## Not checked

- The stopped screen and the "Rejoining your game…" screen, which a script can't reach easily. They
  use the same text colours as the other screens.
- Contrast of non-text parts, such as borders and the focus ring, wasn't measured. P4 only checked
  that the focus ring appears (`NFR-SYS-08-kitchen-sink-checks.md`).
