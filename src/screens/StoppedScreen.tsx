import { useStore } from "zustand";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { FOCUS_RING } from "@/components/focusRing";
import { STOPPED_TEXT, WIN_TEXT } from "@/feedback/copy";
import type { GameStore } from "@/store/gameStore";
import { useUiStore } from "@/store/uiStore";

export interface StoppedScreenProps {
  store: GameStore;
}

// The server has already closed this game, so these let go of it without asking the server.
export function StoppedScreen({ store }: StoppedScreenProps) {
  const forgetRoom = useStore(store, (state) => state.forgetRoom);
  const goTo = useUiStore((state) => state.goTo);

  function leaveTo(screen: "main" | "setup") {
    forgetRoom();
    goTo(screen);
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-4 p-4 pt-12">
      <Card className="flex flex-col items-center gap-4 text-center">
        <h1 tabIndex={-1} className={`text-xl font-bold text-high ${FOCUS_RING}`}>
          {STOPPED_TEXT.title}
        </h1>
        <div className="flex w-full flex-col gap-2">
          <Button onClick={() => leaveTo("setup")}>{WIN_TEXT.newGame}</Button>
          <Button variant="outline" onClick={() => leaveTo("main")}>
            {WIN_TEXT.mainMenu}
          </Button>
        </div>
      </Card>
    </main>
  );
}
