// NFR-SYS-14: the only file allowed to touch localStorage, and it holds display settings only.

import { create, type StoreApi, type UseBoundStore } from "zustand";
import { persist } from "zustand/middleware";
import { PERSIST_SETTINGS } from "@/config/app";
import { DEFAULT_THEME, isTheme, type Theme } from "@/config/themes";

export type { Theme };
export type AnimationMode = "on" | "fast" | "off";

interface SettingsData {
  theme: Theme;
  sound: boolean;
  animation: AnimationMode;
  /** P14: off by default, and only drawn while Animations is on (see Dice). */
  dice3d: boolean;
}

export interface SettingsState extends SettingsData {
  setTheme(theme: Theme): void;
  setSound(sound: boolean): void;
  setAnimation(animation: AnimationMode): void;
  setDice3d(dice3d: boolean): void;
}

const SETTINGS_KEY = "ludo-settings";
const SETTINGS_VERSION = 1;

function buildSettings(set: (partial: Partial<SettingsData>) => void): SettingsState {
  return {
    theme: DEFAULT_THEME,
    sound: true,
    animation: "on",
    dice3d: false,
    setTheme: (theme) => set({ theme }),
    setSound: (sound) => set({ sound }),
    setAnimation: (animation) => set({ animation }),
    setDice3d: (dice3d) => set({ dice3d }),
  };
}

export const useSettingsStore: UseBoundStore<StoreApi<SettingsState>> = PERSIST_SETTINGS
  ? create<SettingsState>()(
      persist(buildSettings, {
        name: SETTINGS_KEY,
        version: SETTINGS_VERSION,
        partialize: ({ theme, sound, animation, dice3d }): SettingsData => ({
          theme,
          sound,
          animation,
          dice3d,
        }),
        // Nothing has changed shape yet. When it does, raise the version and convert old saves here.
        migrate: (saved) => saved as SettingsData,
        // A saved theme that no longer exists, or a hand-edited one, falls back to the default.
        merge: (saved, current) => {
          const data = (saved ?? {}) as Partial<SettingsData>;
          return { ...current, ...data, theme: isTheme(data.theme) ? data.theme : current.theme };
        },
      }),
    )
  : create<SettingsState>()(buildSettings);

// FR-SYS-10 POST-10-3: a theme change is only this attribute, so it can never touch the game.
function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
}

// POST-10-2: CSS reads this attribute to shorten or skip motion. It can't change an outcome.
function applyAnimation(animation: AnimationMode): void {
  document.documentElement.dataset.animation = animation;
}

applyTheme(useSettingsStore.getState().theme);
applyAnimation(useSettingsStore.getState().animation);
useSettingsStore.subscribe((state) => {
  applyTheme(state.theme);
  applyAnimation(state.animation);
});
