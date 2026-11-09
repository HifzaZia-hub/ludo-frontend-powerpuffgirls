// Which screen and modal are showing (docs/03-ui-spec.md §4). Nothing here is about the game.

import { create } from "zustand";
import type { Difficulty, GameMode } from "@/contract/types";

export type Screen = "main" | "setup" | "lobby" | "game" | "win" | "stopped";
export type AppModal = "settings" | "rules";

/** What the player last chose on the setup form. In memory only (NFR-SYS-14). */
export interface SetupChoices {
  seats: "2" | "3" | "4";
  mode: GameMode;
  difficulty: Difficulty;
  name: string;
}

interface UiState {
  screen: Screen;
  modal: AppModal | null;
  lastSetup: SetupChoices | null;
  rememberSetup(choices: SetupChoices): void;
  goTo(screen: Screen): void;
  goToLobby(): void;
  openModal(modal: AppModal): void;
  closeModal(): void;
}

export const useUiStore = create<UiState>()((set) => ({
  screen: "main",
  modal: null,
  lastSetup: null,
  rememberSetup: (lastSetup) => set({ lastSetup }),
  goTo: (screen) => set({ screen }),
  // A computer game starts straight after it is created, and GAME_STARTED can arrive before the
  // reply that sends the player here. That must not pull them back out of the game.
  goToLobby: () => set((state) => (state.screen === "game" ? state : { screen: "lobby" })),
  openModal: (modal) => set({ modal }),
  closeModal: () => set({ modal: null }),
}));
