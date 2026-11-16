import { afterEach, describe, expect, it, vi } from "vitest";

// The store reads what was saved when it is first made, so each test makes a fresh one.
async function freshStore() {
  vi.resetModules();
  return (await import("@/store/settingsStore")).useSettingsStore;
}

function save(theme: string): void {
  localStorage.setItem(
    "ludo-settings",
    JSON.stringify({ state: { theme, sound: false, animation: "fast" }, version: 1 }),
  );
}

afterEach(() => localStorage.clear());

describe("settingsStore", () => {
  it("brings back a saved theme and the other settings", async () => {
    save("forest");

    const store = await freshStore();

    expect(store.getState()).toMatchObject({ theme: "forest", sound: false, animation: "fast" });
  });

  // P14: a theme can be removed, or a save edited by hand, and the page must still have colours.
  it("falls back to dark for a saved theme that doesn't exist", async () => {
    save("sepia");

    const store = await freshStore();

    expect(store.getState().theme).toBe("dark");
    expect(store.getState().sound).toBe(false);
  });

  // FR-SYS-10 POST-10-3: a theme change is only this attribute.
  it("puts the chosen theme on the page", async () => {
    const store = await freshStore();

    store.getState().setTheme("neon");

    expect(document.documentElement.dataset.theme).toBe("neon");
  });
});
