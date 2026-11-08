import { useEffect, useRef } from "react";
import { useStore } from "zustand";
import { useAdapterSubscription } from "@/adapter/useAdapterSubscription";
import { Button } from "@/components/Button";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ToastRegion } from "@/components/ToastRegion";
import { SETTINGS_TEXT } from "@/feedback/copy";
import { useAppNavigation } from "@/interaction/useAppNavigation";
import { GameScreen } from "@/screens/GameScreen";
import { LobbyScreen } from "@/screens/LobbyScreen";
import { MainScreen } from "@/screens/MainScreen";
import { RulesModal } from "@/screens/RulesModal";
import { SettingsModal } from "@/screens/SettingsModal";
import { SetupScreen } from "@/screens/SetupScreen";
import type { GameStore } from "@/store/gameStore";
import { useUiStore } from "@/store/uiStore";

interface AppProps {
  store: GameStore;
}

export function App({ store }: AppProps) {
  useAdapterSubscription(store);
  useAppNavigation(store);

  const screen = useUiStore((state) => state.screen);
  const openModal = useUiStore((state) => state.openModal);
  const toasts = useStore(store, (state) => state.toasts);
  const dismissToast = useStore(store, (state) => state.dismissToast);
  const snapshot = useStore(store, (state) => state.snapshot);
  const resync = useStore(store, (state) => state.resync);
  // P10 builds the win screen. Nothing navigates to it yet.
  const inGame = screen === "game" || screen === "win";

  const screenRef = useRef<HTMLDivElement>(null);
  const lastScreen = useRef(screen);

  // NFR-SYS-08: the button just pressed no longer exists, so put keyboard and screen-reader users
  // at the top of the new screen. Compared rather than run once so StrictMode can't trigger it.
  useEffect(() => {
    if (lastScreen.current === screen) return;
    lastScreen.current = screen;
    screenRef.current?.querySelector("h1")?.focus();
  }, [screen]);

  return (
    <>
      <div ref={screenRef}>
        {screen === "main" && <MainScreen store={store} />}
        {screen === "setup" && <SetupScreen store={store} />}
        {screen === "lobby" && <LobbyScreen store={store} />}
        {/* Out here so it also catches a crash in the store selectors GameScreen reads. */}
        {inGame && (
          <ErrorBoundary resetKey={snapshot} onResync={() => void resync()}>
            <GameScreen store={store} />
          </ErrorBoundary>
        )}
      </div>

      {/* After the screen in the page, so it is the last stop when tabbing. FR-SYS-10.
          The game screen has Settings in its top bar. */}
      {!inGame && (
        <div className="fixed right-4 top-4">
          <Button variant="ghost" size="sm" onClick={() => openModal("settings")}>
            {/* U+FE0E asks for the plain glyph, so it takes the theme's text colour, not an emoji's. */}
            <span aria-hidden="true">{"⚙︎"}</span>
            {SETTINGS_TEXT.title}
          </Button>
        </div>
      )}

      <SettingsModal />
      <RulesModal store={store} />
      <ToastRegion toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}
