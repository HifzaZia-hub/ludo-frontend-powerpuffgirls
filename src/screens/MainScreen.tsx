import { useRef, useState } from "react";
import { Button } from "@/components/Button";
import { Crown } from "@/components/Crown";
import { DieIcon } from "@/components/DieIcon";
import { FOCUS_RING } from "@/components/focusRing";
import { HeroDie } from "@/components/HeroDie";
import { Icon } from "@/components/Icon";
import { Modal } from "@/components/Modal";
import { Pawn } from "@/components/Pawn";
import { COLOURS } from "@/config/players";
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
    <main className="relative flex min-h-screen flex-col items-center justify-center px-4 pb-6 pt-16">
      {/* The brand in the corner. The big title below says the same, so this one is hidden. */}
      <div
        aria-hidden="true"
        className="absolute left-4 top-4 flex items-center gap-3 text-[15px] text-mid sm:left-6"
      >
        <span className="wordmark flex items-center gap-2 text-lg font-extrabold text-high">
          <DieIcon className="h-7 w-7" />
          {MAIN_TEXT.wordmark}
        </span>
        <span className="hidden h-5 w-px bg-[var(--panel-edge)] sm:block" />
        <span className="hidden sm:block">{MAIN_TEXT.tagline}</span>
      </div>

      <div className="flex flex-col items-center">
        <Crown className="-mb-2 h-7 w-10" />
        <HeroDie />
      </div>

      <header className="flex flex-col items-center text-center">
        {/* Two colours, two parts; the label keeps it one word ("LUDO", not "LU DO") when read. */}
        <h1
          tabIndex={-1}
          aria-label={MAIN_TEXT.wordmark}
          className={`wordmark text-7xl font-black italic leading-none [@media(min-height:900px)]:text-8xl ${FOCUS_RING}`}
        >
          <span className="text-high">{MAIN_TEXT.wordmark.slice(0, 2)}</span>
          <span className="text-[var(--title-accent)]">{MAIN_TEXT.wordmark.slice(2)}</span>
        </h1>
        <p className="mt-3 text-lg font-bold italic text-high">{MAIN_TEXT.tagline}</p>
        {/* One pawn per player, as on the board. Decoration only. */}
        <div aria-hidden="true" className="mt-4 flex items-end gap-3">
          {COLOURS.map((colour) => (
            <Pawn key={colour} colour={colour} badge={false} className="h-12 w-12" />
          ))}
        </div>
      </header>

      <div className="mt-6 flex w-full max-w-sm flex-col gap-3">
        <Button size="lg" onClick={() => goTo("setup")} className="justify-between !px-5 text-lg">
          <Icon name="play" className="h-5 w-5" />
          <span className="flex-1 text-center">{MAIN_TEXT.newGame}</span>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--on-accent)_85%,transparent)] text-[var(--accent)]">
            <Icon name="chevronRight" className="h-4 w-4" />
          </span>
        </Button>
        <Button
          size="lg"
          variant="outline"
          onClick={() => setJoining(true)}
          className="justify-between !px-5 text-lg"
        >
          <Icon name="users" className="h-5 w-5" />
          <span className="flex-1 text-center">{MAIN_TEXT.joinGame}</span>
          <Icon name="chevronRight" className="h-4 w-4" />
        </Button>
        {/* D2 FR-07: the rules are one press away before any game exists. */}
        <Button variant="ghost" onClick={() => openModal("rules")} className="self-center">
          <Icon name="info" className="h-4 w-4" />
          <span className="underline underline-offset-4">{MAIN_TEXT.howToPlay}</span>
        </Button>
      </div>

      <ul className="glow-panel mt-6 grid w-full max-w-2xl grid-cols-1 gap-3 rounded-2xl bg-panel px-5 py-3 sm:grid-cols-3">
        {MAIN_TEXT.features.map((feature) => (
          <li key={feature.title} className="flex items-center gap-3">
            <Icon name={feature.icon} className="h-7 w-7 text-[var(--title-accent)]" />
            <span className="flex flex-col text-left">
              <span className="text-[15px] font-semibold text-high">{feature.title}</span>
              <span className="text-xs text-mid">{feature.text}</span>
            </span>
          </li>
        ))}
      </ul>

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
