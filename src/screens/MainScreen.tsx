import { useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState, type CSSProperties } from "react";
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
import { useSettingsStore } from "@/store/settingsStore";
import { useUiStore } from "@/store/uiStore";

// Where the drifting lights sit, as percentages of the screen, and how big and late each one is.
// Fixed, so the page looks the same every time.
const SPARKLES = [
  { left: 12, top: 18, size: 6, delay: 0 },
  { left: 22, top: 62, size: 4, delay: 1.1 },
  { left: 31, top: 34, size: 5, delay: 2.3 },
  { left: 68, top: 22, size: 6, delay: 0.6 },
  { left: 77, top: 58, size: 4, delay: 1.8 },
  { left: 86, top: 36, size: 7, delay: 2.9 },
  { left: 8, top: 82, size: 5, delay: 3.2 },
  { left: 92, top: 80, size: 5, delay: 0.3 },
  { left: 45, top: 12, size: 4, delay: 2.6 },
  { left: 57, top: 88, size: 6, delay: 1.4 },
];

/** For the staggered entrance: an element's place in the order. */
function order(place: number): CSSProperties {
  return { "--d": place } as CSSProperties;
}

export interface MainScreenProps {
  store: GameStore;
}

export function MainScreen({ store }: MainScreenProps) {
  const goTo = useUiStore((state) => state.goTo);
  const openModal = useUiStore((state) => state.openModal);
  const animation = useSettingsStore((state) => state.animation);
  const reducedMotion = useReducedMotion() === true;
  const [joining, setJoining] = useState(false);
  const codeFieldRef = useRef<HTMLInputElement>(null);

  // Parallax: the background and the die lean away from the pointer a little. Movement the player
  // didn't ask for, so it stays off with Animations Off or a reduced-motion preference.
  useEffect(() => {
    if (animation === "off" || reducedMotion) return;
    const root = document.documentElement;
    let frame = 0;
    function lean(event: PointerEvent) {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        root.style.setProperty("--px", ((event.clientX / innerWidth) * 2 - 1).toFixed(3));
        root.style.setProperty("--py", ((event.clientY / innerHeight) * 2 - 1).toFixed(3));
      });
    }
    window.addEventListener("pointermove", lean, { passive: true });
    return () => {
      window.removeEventListener("pointermove", lean);
      cancelAnimationFrame(frame);
      root.style.removeProperty("--px");
      root.style.removeProperty("--py");
    };
  }, [animation, reducedMotion]);

  const letters = MAIN_TEXT.wordmark.split("");

  return (
    // Fits the window at every common size, so the front page never scrolls (theme.css .front-page).
    <main className="front-page relative flex flex-col items-center justify-center overflow-hidden px-4">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        {SPARKLES.map((sparkle) => (
          <span
            key={`${sparkle.left}:${sparkle.top}`}
            className="sparkle"
            style={
              {
                left: `${sparkle.left}%`,
                top: `${sparkle.top}%`,
                "--s": `${sparkle.size}px`,
                "--delay": `${sparkle.delay}s`,
              } as CSSProperties
            }
          />
        ))}
      </div>

      {/* The brand in the corner. The big title below says the same, so this one is hidden. */}
      <div
        aria-hidden="true"
        style={order(0)}
        className="enter-up absolute left-4 top-4 flex items-center gap-3 text-[15px] text-mid sm:left-6"
      >
        <span className="wordmark flex items-center gap-2 text-lg font-extrabold text-high">
          <DieIcon className="h-7 w-7" />
          {MAIN_TEXT.wordmark}
        </span>
        <span className="hidden h-5 w-px bg-[var(--panel-edge)] sm:block" />
        <span className="hidden sm:block">{MAIN_TEXT.tagline}</span>
      </div>

      <div className="parallax-near flex flex-col items-center">
        <Crown className="crown-drop -mb-2 h-7 w-10" />
        <div style={order(0)} className="enter-drop">
          <HeroDie />
        </div>
      </div>

      <header className="flex flex-col items-center text-center">
        {/* Two colours, one letter at a time; the label keeps it one word when read out. */}
        <h1
          tabIndex={-1}
          aria-label={MAIN_TEXT.wordmark}
          className={`wordmark front-title font-black italic leading-none ${FOCUS_RING}`}
        >
          {letters.map((letter, index) => (
            <span
              key={`${letter}${index}`}
              aria-hidden="true"
              style={order(index)}
              className={`letter ${index < 2 ? "text-high" : "text-[var(--title-accent)]"}`}
            >
              {letter}
            </span>
          ))}
        </h1>
        <p style={order(6)} className="enter-up front-tagline font-bold italic text-high">
          {MAIN_TEXT.tagline}
        </p>
        {/* One pawn per player, as on the board. Each one hops when pointed at. Decoration only. */}
        <div aria-hidden="true" className="front-pawns flex items-end gap-3">
          {COLOURS.map((colour, index) => (
            <span key={colour} style={order(7 + index)} className="enter-up">
              <span className="pawn-hover">
                <Pawn colour={colour} badge={false} className="front-pawn" />
              </span>
            </span>
          ))}
        </div>
      </header>

      <div className="front-actions flex w-full max-w-sm flex-col">
        <span style={order(11)} className="enter-up flex flex-col">
          <Button size="lg" onClick={() => goTo("setup")} className="justify-between !px-5 text-lg">
            <Icon name="play" className="h-5 w-5" />
            <span className="flex-1 text-center">{MAIN_TEXT.newGame}</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--on-accent)_85%,transparent)] text-[var(--accent)] transition-transform duration-200 group-hover:translate-x-1">
              <Icon name="chevronRight" className="h-4 w-4" />
            </span>
          </Button>
        </span>
        <span style={order(12)} className="enter-up flex flex-col">
          <Button
            size="lg"
            variant="outline"
            onClick={() => setJoining(true)}
            className="justify-between !px-5 text-lg"
          >
            <Icon name="users" className="h-5 w-5" />
            <span className="flex-1 text-center">{MAIN_TEXT.joinGame}</span>
            <span className="transition-transform duration-200 group-hover:translate-x-1">
              <Icon name="chevronRight" className="h-4 w-4" />
            </span>
          </Button>
        </span>
        {/* D2 FR-07: the rules are one press away before any game exists. */}
        <span style={order(13)} className="enter-up flex flex-col items-center">
          <Button variant="ghost" onClick={() => openModal("rules")}>
            <Icon name="info" className="h-4 w-4" />
            <span className="underline underline-offset-4">{MAIN_TEXT.howToPlay}</span>
          </Button>
        </span>
      </div>

      {/* In a short window the feature strip goes, so the buttons still fit without scrolling:
          under 600 px tall, or under 760 px on a phone, where it stacks into three rows. It only
          sums up the game, so nothing is lost. A class here, as it must beat `grid`. */}
      <ul
        style={order(14)}
        className="enter-up glow-panel front-strip grid w-full max-w-2xl grid-cols-1 gap-3 rounded-2xl bg-panel px-5 py-3 sm:grid-cols-3 [@media(max-height:599px)]:hidden [@media(max-width:639px)_and_(max-height:759px)]:hidden"
      >
        {MAIN_TEXT.features.map((feature) => (
          <li key={feature.title} className="group flex items-center gap-3">
            <span className="transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:scale-110">
              <Icon name={feature.icon} className="h-7 w-7 text-[var(--title-accent)]" />
            </span>
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
