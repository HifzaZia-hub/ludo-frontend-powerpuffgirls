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

- This was recorded at P3, when `sessionToken` wasn't stored anywhere. See the update below.
- Saving settings on the device is still TO CONFIRM (ALT-10-1). Setting `PERSIST_SETTINGS` to
  `false` in `src/config/app.ts` turns it off.

## Update after P5

Checked on 2026-11-08, on branch `feat/p5-main-setup-lobby`, in Microsoft Edge against the mock.

| Check | Result |
|---|---|
| `src/` files that use `localStorage` or `sessionStorage`, leaving out tests and test setup | Only `src/store/settingsStore.ts` and `src/store/savedSession.ts` |
| `localStorage` after creating a room | Nothing about the game |
| `sessionStorage` after creating a room | `ludo-session`, holding `sessionToken`, `playerId` and `roomCode` (`CLAUDE.md` §4) |
| The token anywhere in the page's HTML | Not found |
| `sessionStorage` after leaving the room | `ludo-session` is gone |

P11 reads this back so a player survives a page refresh. Until then nothing reads it.
