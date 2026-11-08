// Which screen and modal are showing (docs/03-ui-spec.md §4). Nothing here is about the game.

import { create } from "zustand";

export type Screen = "main" | "setup" | "lobby" | "game" | "win";
export type AppModal = "settings" | "rules";

interface UiState {
  screen: Screen;
  modal: AppModal | null;
  goTo(screen: Screen): void;
  goToLobby(): void;
  openModal(modal: AppModal): void;
  closeModal(): void;
}

export const useUiStore = create<UiState>()((set) => ({
  screen: "main",
  modal: null,
  goTo: (screen) => set({ screen }),
  // A computer game starts straight after it is created, and GAME_STARTED can arrive before the
  // reply that sends the player here. That must not pull them back out of the game.
  goToLobby: () => set((state) => (state.screen === "game" ? state : { screen: "lobby" })),
  openModal: (modal) => set({ modal }),
  closeModal: () => set({ modal: null }),
}));
