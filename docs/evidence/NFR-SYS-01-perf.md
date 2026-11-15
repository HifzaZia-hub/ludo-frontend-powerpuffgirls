# Time from a press to what you see (NFR-SYS-01)

Requirement: a visible acknowledgement of any action within 1 s. The prompt's target is well under
100 ms.

Run on 2026-11-15 with `npm run e2e -- perf` in Chrome 157 (headless) on the dev server, against the
mock with the computer waiting 300 ms. Presses went in through the DevTools Protocol, the same way
the browser receives real input.

## Two measurements

1. **First change, and the next frame.** Just before each press, the page started watching the DOM.
   This gives the time from the press to the first change (the die going busy, a move being picked)
   and to the start of the next frame, which is the frame that draws that change.
2. **Event Timing.** The browser's own measure from the input to the next paint, for every input
   event of 16 ms or more (it doesn't report faster ones).

## Results

| Press | Count | Press → first change | Press → next frame |
|---|---|---|---|
| Roll, by mouse | 7 | 7–15 ms | 15–18 ms |
| Roll, by the R key | 7 | 4–12 ms | 11–17 ms |
| Pick a move, by mouse | 10 | 5–16 ms | 9–35 ms |
| Move, by Enter | 5 | 8–9 ms | 10–12 ms |
| Move, by mouse | 5 | 6–18 ms | 12–21 ms |

Event Timing, input to next paint: the slowest pointer events (pointerdown, pointerup, click) took
88 ms, and the slowest keydown 64 ms.

**The worst case is 88 ms**, well under 1 s and under the 100 ms target. No console errors.

## The trace

The run also records a Chrome trace of its first presses. It is about 3 MB, so it isn't kept in the
repo. To look at it, run `npm run e2e -- perf`, then in Chrome open DevTools → Performance → Load
profile and choose the `NFR-SYS-01-trace.json.gz` file whose path the script prints.

The prompt asked for a screenshot of the Performance panel. A headless browser can't show DevTools,
so the numbers above take its place.

## Not measured

- A real mouse and a real screen add their own delay, which this can't see.
- Only Chrome on one fast laptop. A slow school computer would be slower, but there is room: 88 ms
  against a 1 s limit.
