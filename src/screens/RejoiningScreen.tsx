import { useStore } from "zustand";
import { Button } from "@/components/Button";
import { FOCUS_RING } from "@/components/focusRing";
import { CONNECTION_TEXT, WIN_TEXT } from "@/feedback/copy";
import type { GameStore } from "@/store/gameStore";
import { useUiStore } from "@/store/uiStore";

export interface RejoiningScreenProps {
  store: GameStore;
}

// Shown only for the moment between a refresh and the first message from the server. If the
// server can't be reached that moment doesn't end, so there is always a way out.
export function RejoiningScreen({ store }: RejoiningScreenProps) {
  const forgetRoom = useStore(store, (state) => state.forgetRoom);
  const goTo = useUiStore((state) => state.goTo);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-4 text-center">
      <span
        aria-hidden="true"
        className="h-8 w-8 animate-spin rounded-full border-4 border-mid border-r-transparent"
      />
      <h1 tabIndex={-1} className={`text-xl font-semibold text-high ${FOCUS_RING}`}>
        {CONNECTION_TEXT.rejoining}
      </h1>
      <Button
        variant="ghost"
        onClick={() => {
          forgetRoom();
          goTo("main");
        }}
      >
        {WIN_TEXT.mainMenu}
      </Button>
    </main>
  );
}
