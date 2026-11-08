import { useRef, useState } from "react";
import { Button } from "@/components/Button";
import { FOCUS_RING } from "@/components/focusRing";
import { Modal } from "@/components/Modal";
import { JOIN_TEXT, MAIN_TEXT } from "@/feedback/copy";
import { JoinForm } from "@/screens/JoinForm";
import type { GameStore } from "@/store/gameStore";
import { useUiStore } from "@/store/uiStore";

export interface MainScreenProps {
  store: GameStore;
}

export function MainScreen({ store }: MainScreenProps) {
  const goTo = useUiStore((state) => state.goTo);
  const openModal = useUiStore((state) => state.openModal);
  const [joining, setJoining] = useState(false);
  const codeFieldRef = useRef<HTMLInputElement>(null);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-4 pt-16">
      <header className="text-center">
        <h1
          tabIndex={-1}
          className={`inline-block text-[32px] font-bold tracking-widest ${FOCUS_RING}`}
        >
          {MAIN_TEXT.wordmark}
        </h1>
        <p className="mt-1 text-[15px] text-mid">{MAIN_TEXT.tagline}</p>
      </header>

      <div className="flex w-full max-w-xs flex-col gap-3">
        <Button size="lg" onClick={() => goTo("setup")}>
          {MAIN_TEXT.newGame}
        </Button>
        <Button size="lg" variant="outline" onClick={() => setJoining(true)}>
          {MAIN_TEXT.joinGame}
        </Button>
        {/* D2 FR-07: the rules are one press away before any game exists. */}
        <Button size="lg" variant="ghost" onClick={() => openModal("rules")}>
          {MAIN_TEXT.howToPlay}
        </Button>
      </div>

      <Modal
        open={joining}
        title={JOIN_TEXT.title}
        onClose={() => setJoining(false)}
        initialFocusRef={codeFieldRef}
      >
        <JoinForm store={store} codeFieldRef={codeFieldRef} />
      </Modal>
    </main>
  );
}
