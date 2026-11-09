import confetti from "canvas-confetti";
import { useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useStore } from "zustand";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { DiceFairnessCheck } from "@/components/DiceFairnessCheck";
import { FOCUS_RING } from "@/components/focusRing";
import { PlayerMark } from "@/components/PlayerMark";
import { SHOW_SESSION_SCORE } from "@/config/app";
import { MESSAGES, WIN_TEXT, winsLabel } from "@/feedback/copy";
import { selectHostName, selectIsHost, type GameStore } from "@/store/gameStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useUiStore } from "@/store/uiStore";

// The server rate-limits restarts (docs/01-contract.md §3).
const PLAY_AGAIN_COOLDOWN_MS = 5000;

export interface WinScreenProps {
  store: GameStore;
}

// FR-SYS-06: shows what the server reported and works nothing out itself (EXC-06-1).
export function WinScreen({ store }: WinScreenProps) {
  const snapshot = useStore(store, (state) => state.snapshot);
  const pending = useStore(store, (state) => state.pendingCommand);
  const sessionWins = useStore(store, (state) => state.sessionWins);
  const isHost = useStore(store, selectIsHost);
  const hostName = useStore(store, selectHostName);
  const restart = useStore(store, (state) => state.restart);
  const leaveRoom = useStore(store, (state) => state.leaveRoom);
  const goTo = useUiStore((state) => state.goTo);
  const animation = useSettingsStore((state) => state.animation);
  const reducedMotion = useReducedMotion() === true;

  const [coolingDown, setCoolingDown] = useState(false);
  const cooldown = useRef<ReturnType<typeof setTimeout>>();
  const celebrated = useRef(false);

  useEffect(() => () => clearTimeout(cooldown.current), []);

  useEffect(() => {
    if (celebrated.current || animation === "off" || reducedMotion) return;
    celebrated.current = true;
    void confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
  }, [animation, reducedMotion]);

  if (snapshot === null) return null; // the moment between leaving and the main screen

  const winner = snapshot.players.find(({ id }) => id === snapshot.winnerId) ?? null;
  // POST-06-3: only if the server sent it, and in the server's order.
  const places = (snapshot.ranking ?? []).flatMap((playerId, index) => {
    const player = snapshot.players.find(({ id }) => id === playerId);
    return player && playerId !== snapshot.winnerId ? [{ player, place: index + 1 }] : [];
  });
  const busy = pending !== null;

  async function handlePlayAgain() {
    setCoolingDown(true);
    cooldown.current = setTimeout(() => setCoolingDown(false), PLAY_AGAIN_COOLDOWN_MS);
    await restart(); // on success the new match moves everyone to the game screen
  }

  async function handleNewGame() {
    if (await leaveRoom()) goTo("setup");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-4 p-4 pt-12">
      <Card className="flex flex-col items-center gap-3 text-center">
        <span aria-hidden="true" className="text-5xl text-warning">
          {"♛︎"}
        </span>
        {winner && <PlayerMark colour={winner.colour} />}
        <h1 tabIndex={-1} className={`text-2xl font-bold text-high ${FOCUS_RING}`}>
          {winner ? MESSAGES.gameOver(winner.name) : WIN_TEXT.over}
        </h1>

        {places.length > 0 && (
          <section aria-label={WIN_TEXT.places} className="w-full">
            <h2 className="text-xs font-semibold uppercase text-low">{WIN_TEXT.places}</h2>
            <ul className="mt-1 flex flex-col gap-1 text-[15px] text-high">
              {places.map(({ player, place }) => (
                <li key={player.id} className="flex items-center justify-center gap-2">
                  <PlayerMark colour={player.colour} size="sm" />
                  {WIN_TEXT.place(place, player.name)}
                </li>
              ))}
            </ul>
          </section>
        )}

        {SHOW_SESSION_SCORE && (
          <section aria-label={WIN_TEXT.sessionScore} className="w-full">
            <h2 className="text-xs font-semibold uppercase text-low">{WIN_TEXT.sessionScore}</h2>
            <dl className="mt-1 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-[15px] text-high">
              {snapshot.players.map((player) => (
                <div key={player.id} className="contents">
                  <dt className="truncate text-left">{player.name}</dt>
                  <dd className="text-right">{winsLabel(sessionWins[player.id] ?? 0)}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}
      </Card>

      <div className="flex flex-col gap-2">
        {isHost ? (
          <Button
            size="lg"
            pending={pending?.kind === "restart"}
            disabled={coolingDown && pending?.kind !== "restart"}
            onClick={() => void handlePlayAgain()}
          >
            {WIN_TEXT.playAgain}
          </Button>
        ) : (
          <p role="status" className="text-center text-[15px] text-mid">
            {hostName ? WIN_TEXT.waitingForHost(hostName) : WIN_TEXT.waitingForAnyHost}
          </p>
        )}
        <Button variant="outline" disabled={busy} onClick={() => void handleNewGame()}>
          {WIN_TEXT.newGame}
        </Button>
        <Button variant="ghost" disabled={busy} onClick={() => void leaveRoom()}>
          {WIN_TEXT.mainMenu}
        </Button>
      </div>

      {/* Last, so opening it never pushes Play again down the page. */}
      {snapshot.seed && <DiceFairnessCheck seed={snapshot.seed} seedHash={snapshot.seedHash} />}
    </main>
  );
}
