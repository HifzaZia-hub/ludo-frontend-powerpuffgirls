// CLAUDE.md §4: the session token lives in sessionStorage, so each browser tab is its own player.
// Never log or render it. P11 reads this back to survive a page refresh.

const SESSION_KEY = "ludo-session";

export interface SavedSession {
  sessionToken: string;
  playerId: string;
  roomCode: string;
}

// A browser can block storage. That only costs the refresh recovery, so it must never stop
// someone from playing.
export function saveSession(session: SavedSession): void {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // Carry on without it, as above.
  }
}

/** What a refresh needs to get back into the game, or null if there is nothing usable. */
export function loadSavedSession(): SavedSession | null {
  try {
    const saved: unknown = JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? "null");
    if (typeof saved !== "object" || saved === null) return null;
    const { sessionToken, playerId, roomCode } = saved as Partial<SavedSession>;
    if (typeof sessionToken !== "string" || typeof playerId !== "string") return null;
    if (typeof roomCode !== "string") return null;
    return { sessionToken, playerId, roomCode };
  } catch {
    return null; // storage is blocked, or something else wrote there
  }
}

export function clearSavedSession(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // Nothing could have been saved either.
  }
}
