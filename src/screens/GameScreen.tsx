import { useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { useStore } from "zustand";
import { Board } from "@/components/Board";
import { BoardGrid } from "@/components/BoardGrid";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DicePanel } from "@/components/DicePanel";
import { EventBanner } from "@/components/EventBanner";
import { MessageLog } from "@/components/MessageLog";
import { MoveList } from "@/components/MoveList";
import { PieceLayer } from "@/components/PieceLayer";
import { StatusPanel, type StatusPanelPlayer } from "@/components/StatusPanel";
import { TopBar, type TurnDisplay } from "@/components/TopBar";
import { SHOW_SESSION_SCORE } from "@/config/app";
import type { Player } from "@/contract/types";
import { CONFIRM_TEXT, GAME_TEXT, MESSAGES, TURN_TEXT, type PLAYER_TAGS } from "@/feedback/copy";
import { diceTumbleMs, eventTimings, pieceTweenSeconds } from "@/feedback/motion";
import { useEventFeedback } from "@/feedback/useEventFeedback";
import { useDiceRoll } from "@/interaction/useDiceRoll";
import { useGameKeys } from "@/interaction/useGameKeys";
import { useMoveSelection } from "@/interaction/useMoveSelection";
import { useMoveWalk } from "@/interaction/useMoveWalk";
import {
  secondsUntil,
  selectActivePlayer,
  selectCanRoll,
  selectIsMyTurn,
  selectPiecesByCell,
  selectPlayerProgress,
  selectIsHost,
  selectTurnKind,
  type GameStore,
  type PlayerProgress,
  type TurnKind,
} from "@/store/gameStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useUiStore } from "@/store/uiStore";

function playerTag(player: Player, myPlayerId: string | null): keyof typeof PLAYER_TAGS | undefined {
  if (player.isAi) return "computer";
  if (!player.connected) return "offline";
  return player.id === myPlayerId ? "you" : undefined;
}

function turnText(kind: TurnKind, name: string): string {
  if (kind === "human") return TURN_TEXT.human(name);
  if (kind === "noMove") return MESSAGES.turnPassed(name);
  return TURN_TEXT[kind];
}

// FR-SYS-06, docs/02-board-model.md §6: piecesHome is the server's own count. If ours ever differs,
// the server is right and our step mapping is wrong, so say so loudly during development.
function reportHomeMismatches(rows: readonly PlayerProgress[]): void {
  for (const { player, counts } of rows) {
    if (counts.home !== player.piecesHome) {
      console.error(
        `Home count mismatch for ${player.name}: the pieces say ${counts.home}, ` +
          `the server says ${player.piecesHome}.`,
      );
    }
  }
}

export interface GameScreenProps {
  store: GameStore;
}

// FR-SYS-09: every part of the game fits on this one screen.
export function GameScreen({ store }: GameScreenProps) {
  const snapshot = useStore(store, (state) => state.snapshot);
  const myPlayerId = useStore(store, (state) => state.myPlayerId);
  const activePlayer = useStore(store, selectActivePlayer);
  const progress = useStore(store, selectPlayerProgress);
  const piecesByCell = useStore(store, selectPiecesByCell);
  const canRoll = useStore(store, selectCanRoll);
  const isMyTurn = useStore(store, selectIsMyTurn);
  const turnKind = useStore(store, selectTurnKind);

  const openModal = useUiStore((state) => state.openModal);
  const sound = useSettingsStore((state) => state.sound);
  const setSound = useSettingsStore((state) => state.setSound);
  const animation = useSettingsStore((state) => state.animation);
  const reducedMotion = useReducedMotion() === true;

  const dieRef = useRef<HTMLButtonElement>(null);
  const { rolling, roll, skip: skipTumble } = useDiceRoll(
    store,
    diceTumbleMs(animation, reducedMotion),
  );
  const selection = useMoveSelection(store, dieRef, rolling);
  const timings = eventTimings(animation, reducedMotion);
  const { walk, skipped, skip: skipWalk } = useMoveWalk(snapshot, timings.stepMs);

  const eventLog = useStore(store, (state) => state.eventLog);
  const errorId = useStore(
    store,
    (state) => state.toasts.filter(({ kind }) => kind === "error").at(-1)?.id ?? null,
  );
  const feedback = useEventFeedback({
    snapshot,
    eventLog,
    myPlayerId,
    timings,
    soundOn: sound,
    errorId,
  });
  const { skip: skipFeedback, gameOver, busy: feedbackBusy } = feedback;

  const isHost = useStore(store, selectIsHost);
  const sessionWins = useStore(store, (state) => state.sessionWins);
  const restart = useStore(store, (state) => state.restart);
  const leaveRoom = useStore(store, (state) => state.leaveRoom);
  const goTo = useUiStore((state) => state.goTo);
  const [confirming, setConfirming] = useState<"restart" | "leave" | null>(null);
  const [confirmSending, setConfirmSending] = useState(false);

  // FR-SYS-06 POST-06-2: only on the server's GAME_OVER, once the last move has played out.
  useEffect(() => {
    if (gameOver && !feedbackBusy) goTo("win");
  }, [gameOver, feedbackBusy, goTo]);

  async function handleConfirm() {
    setConfirmSending(true);
    await (confirming === "restart" ? restart() : leaveRoom());
    // POST-08-3: on failure the game is untouched, and this closes so the error can be read.
    setConfirmSending(false);
    setConfirming(null);
  }

  // D2 FR-38: only ever ends the pictures early. The game has already moved on.
  const skip = useCallback(() => {
    skipWalk();
    skipTumble();
    skipFeedback();
  }, [skipWalk, skipTumble, skipFeedback]);

  useGameKeys({
    onRoll: roll,
    onPickNumber: selection.pickNumber,
    onConfirm: selection.confirm,
    onCancel: selection.cancel,
    onSkip: skip,
  });

  const deadline = snapshot?.turn.deadline;
  const getSecondsLeft = useCallback(() => secondsUntil(deadline, Date.now()), [deadline]);

  useEffect(() => {
    if (import.meta.env.DEV) reportHomeMismatches(progress);
  }, [progress]);

  // Until the die lands, the words mustn't give away what it rolled either.
  const shownKind: TurnKind | null = rolling && isMyTurn ? "myRoll" : turnKind;
  const turn: TurnDisplay | null =
    shownKind && activePlayer
      ? {
          colour: activePlayer.colour,
          text: turnText(shownKind, activePlayer.name),
          thinking: shownKind === "computer",
        }
      : null;

  let announcement = "";
  if (isMyTurn) announcement = selection.options.length > 0 ? TURN_TEXT.myMove : GAME_TEXT.yourTurn;

  const statusPlayers: StatusPanelPlayer[] = progress.map(({ player, counts }) => ({
    id: player.id,
    colour: player.colour,
    name: player.name,
    tag: playerTag(player, myPlayerId),
    counts,
    active: player.id === snapshot?.turn.activePlayerId,
    homeBump: player.id === feedback.bumpPlayerId,
    wins: SHOW_SESSION_SCORE ? sessionWins[player.id] : undefined,
  }));

  return (
    <div className="flex min-h-dvh flex-col lg:h-dvh">
      <TopBar
        turn={turn}
        sound={sound}
        onSoundChange={setSound}
        onRules={() => openModal("rules")}
        onSettings={() => openModal("settings")}
        canRestart={isHost}
        onRestart={() => setConfirming("restart")}
        onLeave={() => setConfirming("leave")}
      />

      {/* Always on the page, because a screen reader only announces changes to a live region. */}
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {snapshot === null ? (
        // Contract §4: GAME_STARTED arrives before the first game:state.
        <main className="flex flex-1 items-center justify-center p-4">
          <p role="status" className="text-[15px] text-mid">
            {GAME_TEXT.loading}
          </p>
        </main>
      ) : (
        // ALT-09-1: under 1024 px the board goes on top, then dice and players, then messages.
        // The side columns follow the window, or they'd take their widest size before the board.
        <main className="grid min-h-0 flex-1 grid-cols-[auto_minmax(0,1fr)] gap-3 p-3 lg:grid-cols-[clamp(13rem,18vw,15rem)_minmax(0,1fr)_clamp(14rem,20vw,17rem)] lg:grid-rows-[auto_minmax(0,1fr)]">
          <StatusPanel
            players={statusPlayers}
            className="col-start-2 row-start-2 lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:min-h-0 lg:overflow-y-auto lg:p-1"
          />
          <Board className="col-span-2 row-start-1 mx-auto aspect-square w-full max-w-[calc(100dvh-5rem)] lg:col-span-1 lg:col-start-2 lg:row-span-2 lg:aspect-auto lg:max-w-none">
            <BoardGrid safeSquares={snapshot.rules.safeSquares} />
            <PieceLayer
              pieces={snapshot.pieces}
              piecesByCell={piecesByCell}
              safeSquares={snapshot.rules.safeSquares}
              tweenSeconds={skipped ? 0 : pieceTweenSeconds(animation, reducedMotion)}
              choice={
                selection.options.length > 0
                  ? {
                      moves: selection.options,
                      selected: selection.selected,
                      locked: selection.locked,
                      onPick: selection.pick,
                      onPreview: selection.preview,
                    }
                  : null
              }
              walk={walk}
              walkSeconds={timings.stepMs / 1000}
              effects={{
                held: feedback.held,
                flashingId: feedback.flashingId,
                returningId: feedback.returningId,
                finishingId: feedback.finishingId,
                returnSeconds: skipped ? 0 : timings.returnMs / 1000,
              }}
            />
            <EventBanner text={feedback.banner} />
            {/* On top of the board's empty corner, so appearing never moves anything else. */}
            {(walk !== null || rolling || feedback.busy) && (
              <Button
                variant="outline"
                size="sm"
                onClick={skip}
                className="absolute right-1 top-1 z-20 bg-panel"
              >
                {GAME_TEXT.skip}
              </Button>
            )}
          </Board>
          <DicePanel
            value={snapshot.turn.lastRoll}
            rolling={rolling}
            canRoll={canRoll}
            onRoll={roll}
            sixesInRow={snapshot.rules.threeSixesForfeit ? snapshot.turn.sixesInRow : null}
            sixesFlash={feedback.sixesFlash}
            getSecondsLeft={snapshot.rules.turnTimerSeconds === 0 ? null : getSecondsLeft}
            totalSeconds={snapshot.rules.turnTimerSeconds}
            showTimeUp={isMyTurn}
            dieRef={dieRef}
            className="col-start-1 row-start-2 lg:col-start-3 lg:row-start-1"
          />
          <div className="col-span-2 row-start-3 flex flex-col gap-3 lg:col-span-1 lg:col-start-3 lg:row-start-2 lg:min-h-0">
            <Card className="lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
              <MessageLog messages={feedback.messages} />
            </Card>
            {/* Below the messages, so appearing never pushes the latest message down. */}
            {selection.options.length > 0 && (
              <MoveList
                moves={selection.options}
                selectedId={selection.selected?.pieceId ?? null}
                locked={selection.locked}
                sending={selection.sending}
                onPick={selection.pick}
                onPreview={selection.preview}
                onConfirm={selection.confirm}
              />
            )}
          </div>
        </main>
      )}

      {/* FR-SYS-08: both of these throw away a game in progress. */}
      <ConfirmDialog
        open={confirming !== null}
        title={CONFIRM_TEXT[confirming ?? "leave"].title}
        body={CONFIRM_TEXT.body}
        confirmLabel={CONFIRM_TEXT[confirming ?? "leave"].action}
        pending={confirmSending}
        onConfirm={() => void handleConfirm()}
        onCancel={() => setConfirming(null)}
      />
    </div>
  );
}
