import confetti from "canvas-confetti";
import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useStore } from "zustand";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { CopyButton } from "@/components/CopyButton";
import { Crown } from "@/components/Crown";
import { DiceFairnessCheck } from "@/components/DiceFairnessCheck";
import { Pawn } from "@/components/Pawn";
import { PlayerMark } from "@/components/PlayerMark";
import { SHOW_SESSION_SCORE } from "@/config/app";
import { PLAYER_IDENTITY } from "@/config/players";
import { MESSAGES, WIN_TEXT, winsLabel } from "@/feedback/copy";
import { revealTimings } from "@/feedback/motion";
import { selectHostName, selectIsHost, selectIsOffline, type GameStore } from "@/store/gameStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useUiStore } from "@/store/uiStore";

// The server rate-limits restarts (docs/01-contract.md §3).
const PLAY_AGAIN_COOLDOWN_MS = 5000;

const PLAYER_TOKENS = ["--p-red", "--p-green", "--p-yellow", "--p-blue"];

// How tall each podium step is, by its position in the server's ranking after the winner.
const STEP_HEIGHTS = ["3.6rem", "2.9rem", "2.3rem"];


export interface WinScreenProps {
  store: GameStore;
}

// FR-SYS-06: shows what the server reported and works nothing out itself (EXC-06-1).
export function WinScreen({ store }: WinScreenProps) {
  const snapshot = useStore(store, (state) => state.snapshot);
  const pending = useStore(store, (state) => state.pendingCommand);
  const sessionWins = useStore(store, (state) => state.sessionWins);
  const isHost = useStore(store, selectIsHost);
  const offline = useStore(store, selectIsOffline);
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
    // In the players' own colours, read from the theme, so it matches whichever theme is on.
    const styles = getComputedStyle(document.documentElement);
    const colors = PLAYER_TOKENS.map((token) => styles.getPropertyValue(token).trim()).filter(Boolean);
    void confetti({
      particleCount: 160,
      spread: 90,
      origin: { y: 0.55 },
      ...(colors.length > 0 ? { colors } : {}),
    });
  }, [animation, reducedMotion]);

  if (snapshot === null) return null; // the moment between leaving and the main screen

  const winner = snapshot.players.find(({ id }) => id === snapshot.winnerId) ?? null;
  // POST-06-3: only if the server sent it, and in the server's order.
  const places = (snapshot.ranking ?? []).flatMap((playerId, index) => {
    const player = snapshot.players.find(({ id }) => id === playerId);
    return player && playerId !== snapshot.winnerId ? [{ player, place: index + 1 }] : [];
  });
  const busy = pending !== null || offline;
  const reveal = revealTimings(animation, reducedMotion);

  // P14: a line to share, built only from the server's winner and ranking (EXC-06-1).
  const rankedNames = (snapshot.ranking ?? []).flatMap(
    (playerId) => snapshot.players.find(({ id }) => id === playerId)?.name ?? [],
  );
  let resultLine: string | null = null;
  if (rankedNames.length > 0) resultLine = WIN_TEXT.resultInOrder(rankedNames);
  else if (winner) resultLine = WIN_TEXT.resultWinner(winner.name);

  async function handlePlayAgain() {
    setCoolingDown(true);
    cooldown.current = setTimeout(() => setCoolingDown(false), PLAY_AGAIN_COOLDOWN_MS);
    await restart(); // on success the new match moves everyone to the game screen
  }

  async function handleNewGame() {
    if (await leaveRoom()) goTo("setup");
  }

  // The spotlight and title glow take the winner's colour; neutral if the server named nobody.
  const winnerStyle = {
    "--winner": winner ? PLAYER_IDENTITY[winner.colour].token : "var(--panel-edge)",
  } as CSSProperties;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center gap-3 p-4 pt-10">
      <Card
        style={winnerStyle}
        className="relative flex flex-col items-center gap-2 overflow-hidden text-center"
      >
        <div aria-hidden="true" className="win-spotlight" />
        {/* P14: in the card's empty corner, so it adds no height and Play again stays in view. */}
        {resultLine && (
          <div className="absolute right-2 top-2 z-10">
            <CopyButton
              text={resultLine}
              label={WIN_TEXT.copyResult}
              copiedLabel={WIN_TEXT.copiedResult}
              failedMessage={WIN_TEXT.copyResultFailed}
              compactFailedLabel={WIN_TEXT.copyResultFailedShort}
            />
          </div>
        )}

        <div aria-hidden="true" className="relative flex flex-col items-center">
          <Crown className="h-7 w-10" />
          {winner && (
            <Pawn colour={winner.colour} badge={false} className="win-pawn -mt-1 h-24 w-24" />
          )}
        </div>
        {/* App moves focus here for screen readers. It isn't a control, so it draws no ring. */}
        <h1 tabIndex={-1} className="win-title relative text-4xl font-extrabold text-high outline-none">
          {winner ? MESSAGES.gameOver(winner.name) : WIN_TEXT.over}
        </h1>
        {/* NFR-SYS-07: the winner's letter and shape, as well as the pawn's colour. */}
        {winner && <PlayerMark colour={winner.colour} />}

        {places.length > 0 && (
          <section aria-label={WIN_TEXT.places} className="relative mt-1 w-full">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-low">
              {WIN_TEXT.places}
            </h2>
            {/* A podium for everyone after the winner, in the server's order (POST-06-3). */}
            <ul className="mt-2 flex items-end justify-center gap-2 border-b border-[var(--panel-edge)] text-[14px] text-high">
              {/* P14: one after another, or all at once with Animations Off or reduced motion. */}
              {places.map(({ player, place }, index) => (
                <motion.li
                  key={player.id}
                  className="flex w-40 min-w-0 flex-col items-center gap-1"
                  initial={reveal.seconds > 0 ? { opacity: 0, y: 6 } : false}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: reveal.seconds, delay: index * reveal.staggerSeconds }}
                >
                  <Pawn colour={player.colour} badge={false} className="h-9 w-9" />
                  <span className="flex max-w-full items-center gap-1">
                    <PlayerMark colour={player.colour} size="sm" />
                    <span className="truncate">{WIN_TEXT.place(place, player.name)}</span>
                  </span>
                  <span
                    aria-hidden="true"
                    data-place={place}
                    style={{ height: STEP_HEIGHTS[index] ?? STEP_HEIGHTS.at(-1) }}
                    className="podium-step w-full rounded-t-lg"
                  />
                </motion.li>
              ))}
            </ul>
          </section>
        )}

        {SHOW_SESSION_SCORE && (
          <section aria-label={WIN_TEXT.sessionScore} className="relative w-full">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-low">
              {WIN_TEXT.sessionScore}
            </h2>
            <dl className="mt-2 flex flex-wrap justify-center gap-2 text-[14px] text-high">
              {snapshot.players.map((player) => (
                <div
                  key={player.id}
                  className="flex items-center gap-2 rounded-full border border-soft bg-raised px-3 py-1"
                >
                  <dt className="max-w-[9rem] truncate">{player.name}</dt>
                  <dd className="font-semibold">{winsLabel(sessionWins[player.id] ?? 0)}</dd>
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
            disabled={(coolingDown || offline) && pending?.kind !== "restart"}
            onClick={() => void handlePlayAgain()}
          >
            {WIN_TEXT.playAgain}
          </Button>
        ) : (
          <p role="status" className="text-center text-[15px] text-mid">
            {hostName ? WIN_TEXT.waitingForHost(hostName) : WIN_TEXT.waitingForAnyHost}
          </p>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" disabled={busy} onClick={() => void handleNewGame()}>
            {WIN_TEXT.newGame}
          </Button>
          <Button variant="ghost" disabled={busy} onClick={() => void leaveRoom()}>
            {WIN_TEXT.mainMenu}
          </Button>
        </div>
      </div>

      {/* Last, so opening it never pushes Play again down the page. */}
      {snapshot.seed && <DiceFairnessCheck seed={snapshot.seed} seedHash={snapshot.seedHash} />}
    </main>
  );
}
