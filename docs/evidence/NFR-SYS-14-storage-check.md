# NFR-SYS-14: no storage for normal play

Checked on 2026-11-08, on branch `feat/p3-adapter-and-store`, in Microsoft Edge against the mock
server.

## In the code

A search of `src/` for `localStorage`, `sessionStorage` and `fetch(`, leaving out test files, found:

| File | Why it matches |
|---|---|
| `src/store/settingsStore.ts` | The file comment. Zustand's `persist` does the actual saving here. |
| `src/testSetup.ts` | Test setup only. It never runs in the app. |
| `src/adapter/LgsAdapter.ts` | The one `fetch` call, to the game server. |

Game state lives only in `gameStore`, in memory. Nothing in it is written to the device.

## In the browser

Steps: start a test game, wait for "Connection: live", switch to the Light theme, reload the page.

| Check | Result |
|---|---|
| Every `localStorage` key | `["ludo-settings"]` |
| What that key holds | `{"state":{"theme":"light","sound":true,"animation":"on"},"version":1}` |
| Every `sessionStorage` key | `[]` |
| Theme after the reload | `light` |

## Limits of this check

- `sessionToken` isn't stored anywhere yet. The temporary test button keeps it in memory. P5 and
  P11 will save it to `sessionStorage`, which `CLAUDE.md` §4 allows.
- Saving settings on the device is still TO CONFIRM (ALT-10-1). Setting `PERSIST_SETTINGS` to
  `false` in `src/config/app.ts` turns it off.
