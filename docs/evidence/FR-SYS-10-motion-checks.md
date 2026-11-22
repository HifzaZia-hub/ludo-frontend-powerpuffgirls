# Motion and sound checks

Micro-interactions, entrances, game motion and new sounds, added after P14. Like P14 this is
polish, but it touches FR-SYS-10 (the Animations and Sound settings), POST-10-2 (motion never
changes an outcome) and the ludo-ui animation budget, so each of those is checked here. Run on
2026-11-22 with `npm run e2e -- motion --fast --build --save`, in Chrome 158 (headless) against
the production build.

## What moves

| Where | Motion |
|---|---|
| Every screen | Fades and grows into place (300 ms). Dialogs scale in over a fading backdrop |
| Front page | The die drops in, the letters of LUDO rise one at a time, then the tagline, pawns, buttons and feature strip. Pawns hop when pointed at. Small lights drift. The background and the die lean away from the pointer |
| Buttons and cards | Buttons lift and glow under the pointer and press down when clicked; primary buttons catch a sweep of light. Cards light up where the pointer is |
| Choices | The highlight glides from the old option to the new one. A chosen colour's mark and tick bounce in |
| Game | The player whose turn it is glows. Pieces that can move bob; a chosen piece lifts. A walking piece hops on every square. A captured piece spins home inside a burst ring; a piece reaching home throws sparks. The die squashes when pressed and a ring of light bursts out when it lands. Counts flip, the turn line and newest message slide in, and filled sixes dots pop |
| Win screen | The crown drops on and wobbles, the podium steps rise one after another, and the score pills pop in |

All of it moves only `transform` (translate, scale, rotate) and `opacity`. Every duration is
multiplied by `--motion`, so Animations Fast runs it at 45 %. Animations Off and the device's
reduced-motion setting set every duration and delay to 0, so nothing is left hidden or late.

## Browser checks (`npm run e2e -- motion`)

| Check | Result |
|---|---|
| On: the front page eases in | ok: `letter-rise`, `enter-up`, `enter-drop`, `crown-drop`, `screen-in` running 250 ms in |
| On: every entrance ends visible and in place | ok: every element with an entrance class at opacity 1, no translate or scale left |
| On: only the idle loops keep going | ok: `twinkle`, `hero-idle`, `orbit-spin`; nothing else running |
| On: the front page's entrance is over within a second | ok: nothing but the loops running at 1050 ms |
| On: no scrollbar flickers while a screen eases in | ok at 1366×768: 0 of 64 frames scrolled (see below) |
| On: the page leans with the pointer | ok: `--px` −0.906 at the top left, 0.906 at the bottom right |
| On: a card lights up under the pointer | ok: `--spot` 1 under the pointer |
| On: the choice highlight glides to the new option | ok: 11 of 43 frames between the two options, ending on the new one |
| Off: a new screen appears at once | ok: 0 animations running two frames after the press |
| Off: the front page appears at once, with no loops | ok: 0 running, nothing hidden |
| Off: the page doesn't lean | ok |
| Reduced motion (Animations On): screens appear at once, with no loops | ok: 0 running |
| Reduced motion: the page doesn't lean | ok |
| Game: the player whose turn it is glows | ok: `turn-pulse` running on the active card |
| Game: the pieces that can move bob | ok: 4 movable pieces, `pawn-bob` running |
| Game: the die flashed as it landed | ok |
| Game: a walking piece hops on each square | ok: `piece-hop` classes seen during a real move |
| Win: the crown and podium are done within a second | ok: nothing of theirs running at 1050 ms |
| Win: the crown and podium animate, then settle | ok: crown and 3 podium steps, all settled |
| No console errors | ok |

Screenshots: `FR-SYS-10-motion-entrance.png` (250 ms into the front page),
`FR-SYS-10-motion-frames.png` (the front page frozen at 0, 150, 300, 480, 680 and 1000 ms, by
pausing every animation and seeking it, so each frame is exact) and
`FR-SYS-10-motion-choosing.png` (the game while choosing a move).

### A bug the checks found

The first version slid each new screen up from 10 px below. For those 300 ms the page was 10 px
taller than the window, so a scrollbar flickered on every screen change. The screen now fades and
grows into place instead. The flicker check was run against the old slide first, to make sure it
can fail: 10 of 54 frames scrolled, and it failed. With the fix, 0 frames scrolled.

### The one-second budget

ludo-ui says nothing but the turn pulse runs longer than a second. Each piece is shorter than
that, and the staggers are set so each sequence also ends inside it:

| Sequence | Ends at |
|---|---|
| Front page (the feature strip comes last) | 14 × 38 + 460 = 992 ms |
| Win screen crown | 160 + 780 = 940 ms |
| Win screen podium (third step) | (3 + 2) × 100 + 480 = 980 ms |
| Win screen score pills (fourth) | 8 × 70 + 380 = 940 ms |

The idle loops (drifting lights, the front page die's slow turn, the die's ring, the turn glow and
the bobbing pieces) run on, but only with no reduced-motion preference, and Animations Off stops
them: that is the pause control WCAG 2.2.2 asks for.

## Unit tests

`src/components/PieceLayer.test.tsx`: a walking piece swaps hop classes on every square while
keeping the same piece element (so keyboard focus survives a walk), the hop stops when the walk
ends, and a returning piece spins for as long as the return takes. `src/components/Piece.test.tsx`:
capture and finish add their bursts; a movable pawn bobs and a chosen one lifts, and neither does
when idle. `src/components/SegmentedControl.test.tsx`: there is one highlight, it moves to the new
choice, and it is hidden from screen readers. All 978 tests pass.

## The other browser checks

`smoke`, `sizes`, `themes`, `contrast`, `grayscale`, `keyboard`, `colours` and `die3d` all passed
on this branch. The test helper that finds a button now waits for animations to finish before
measuring where it is, the way a person waits for a screen to settle; without that, a click
measured while a screen eased in could land beside a small button.

## Sounds

The placeholder tones are replaced by sounds made by `scripts/make-sounds.py` (numpy and scipy,
seeded, so the same file comes out every time). One 3-second sprite at 32 kHz mono, 192 kB.

| Sound | Plays for | Length | Peak | Loudness (RMS) |
|---|---|---|---|---|
| roll | the die rolling: a rattle of clicks and knocks | 380 ms | 0.95 | 0.114 |
| move | a piece stepping: a wooden tap | 140 ms | 0.70 | 0.128 |
| capture | a swoosh and a thud | 360 ms | 0.80 | 0.162 |
| finish | a piece home: three bells, C E G | 390 ms | 0.80 | 0.155 |
| win | a short fanfare, G C E G | 395 ms | 0.80 | 0.228 |
| error | two soft falling notes | 220 ms | 0.60 | 0.215 |

Nothing clips, every sound stays under 400 ms, and each one is silent past its end in the sprite,
so none runs into the next. Sound still waits for the first press and does nothing when off
(`src/feedback/sound.test.ts`, unchanged).

## Not checked here

- Firefox: the `motion` mode needs the reduced-motion emulation that only Chrome and Edge offer.
  The other modes cover Firefox as before.
- How the sounds sound. That needs ears; the numbers above only show they are clean and fit.
- At 1280×720 the front page is a little taller than the window, so it scrolls slightly when
  settled. That was already so before this change (the sizes check covers 768 px and up), and is
  left for a follow-up.
