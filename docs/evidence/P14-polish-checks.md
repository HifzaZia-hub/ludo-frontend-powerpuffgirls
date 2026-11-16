# P14 polish checks

P14 is polish: none of it is in our D2 or D3, so none of it is graded. The prompt asks that each item
keeps the definition of done and the P12 keyboard-only game passing, and that anything breaking an
NFR is reverted. Run on 2026-11-16 in Chrome 157 (headless). Each item is a separate commit.

| Item | Done | What was checked |
|---|---|---|
| 1. Extra themes | Neon, Forest, Minimal | Every theme sets every colour (`src/config/themes.test.ts`). No text below WCAG AA in any of the five (`npm run e2e -- contrast`). Letters and shapes unchanged. Screenshots: `FR-SYS-10-theme-*.png` |
| 2. Win polish | Places revealed in turn, Copy result | The copied line uses only the server's winner and ranking. The places appear at once with Animations Off. Play again is in view with no scrolling at 1280×720 and 1024×768. Screenshot: `FR-SYS-06-win-copy-result.png` |
| 3. 3D die | Optional, off by default | Six rolls by R and by Enter on the die: every landed face matched the server's roll in the message log. It loads inside the same button, and the flat die stays if 3D can't draw. 61 frames a second in headless Chrome, which draws WebGL in software. Screenshots: `NFR-SYS-05-die3d-*.png` |
| 4. 3D pieces | Not done | The riskiest item, and it needs 50+ fps on the slowest team laptop, which can't be measured here |
| 5. Music | Not done | Low value, and it needs an original track |

After every item: typecheck, lint, build and all tests passed (938 at the end), and a whole
keyboard-only game reached a winner with no missed moves.

## Contrast in all five themes

| Theme | Texts checked | Below the target | Closest |
|---|---|---|---|
| Dark | 425 | 0 | 5.38:1 |
| Light | 428 | 0 | 5.33:1 |
| Neon | 424 | 0 | 5.85:1 |
| Forest | 424 | 0 | 5.72:1 |
| Minimal | 444 | 0 | 5.62:1 |

## Download size

| | Main bundle | 3D die file |
|---|---|---|
| `main` before P14 | 244.8 kB (78.1 kB compressed) | — |
| With P14 | 246.9 kB (79.1 kB compressed) | 886.1 kB (237.8 kB compressed) |

The 3D die file downloads only when a player turns the 3D die on.

## The 3D die and NFR-SYS-05

Like the flat die, the 3D die is blank while it tumbles, and then shows only the server's value, on
the face turned to the player. Its other faces stay blank, so it never shows a number the server
didn't send. Its spin uses fixed speeds, never randomness.

## Rerun

```
npm run e2e -- contrast
npm run e2e -- themes
npm run e2e -- smoke
npm run e2e -- die3d
npm run e2e -- keyboard --fast
```
