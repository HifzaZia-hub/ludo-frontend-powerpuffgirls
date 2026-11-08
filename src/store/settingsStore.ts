// NFR-SYS-14: the only file allowed to touch localStorage, and it holds display settings only.

import { create, type StoreApi, type UseBoundStore } from "zustand";
import { persist } from "zustand/middleware";
import { PERSIST_SETTINGS } from "@/config/app";

export type Theme = "dark" | "light";
export type AnimationMode = "on" | "fast" | "off";

interface SettingsData {
  theme: Theme;
  sound: boolean;
  animation: AnimationMode;
}

export interface SettingsState extends SettingsData {
  setTheme(theme: Theme): void;
  setSound(sound: boolean): void;
  setAnimation(animation: AnimationMode): void;
}

const SETTINGS_KEY = "ludo-settings";
const SETTINGS_VERSION = 1;

function buildSettings(set: (partial: Partial<SettingsData>) => void): SettingsState {
  return {
    theme: "dark",
    sound: true,
    animation: "on",
    setTheme: (theme) => set({ theme }),
    setSound: (sound) => set({ sound }),
    setAnimation: (animation) => set({ animation }),
  };
}

export const useSettingsStore: UseBoundStore<StoreApi<SettingsState>> = PERSIST_SETTINGS
  ? create<SettingsState>()(
      persist(buildSettings, {
        name: SETTINGS_KEY,
        version: SETTINGS_VERSION,
        partialize: ({ theme, sound, animation }): SettingsData => ({ theme, sound, animation }),
        // Nothing has changed shape yet. When it does, raise the version and convert old saves here.
        migrate: (saved) => saved as SettingsData,
      }),
    )
  : create<SettingsState>()(buildSettings);

// FR-SYS-10 POST-10-3: a theme change is only this attribute, so it can never touch the game.
function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
}

applyTheme(useSettingsStore.getState().theme);
useSettingsStore.subscribe((state) => applyTheme(state.theme));
