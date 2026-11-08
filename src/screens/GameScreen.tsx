import { useReducedMotion } from "framer-motion";
import { useCallback, useEffect } from "react";
import { useStore } from "zustand";
import { Board } from "@/components/Board";
import { BoardGrid } from "@/components/BoardGrid";
import { Card } from "@/components/Card";
import { DicePanel } from "@/components/DicePanel";
import { MessageLog, type LogMessage } from "@/components/MessageLog";
import { PieceLayer } from "@/components/PieceLayer";
import { StatusPanel, type StatusPanelPlayer } from "@/components/StatusPanel";
import { TopBar, type TurnDisplay } from "@/components/TopBar";
import type { Player } from "@/contract/types";
import { GAME_TEXT, TURN_TEXT, type PLAYER_TAGS } from "@/feedback/copy";
import { diceTumbleMs, pieceTweenSeconds } from "@/feedback/motion";
import { useDiceRoll } from "@/interaction/useDiceRoll";
import { useGameKeys } from "@/interaction/useGameKeys";
import {
  secondsUntil,
  selectActivePlayer,
  selectCanRoll,
  selectIsMyTurn,
  selectPiecesByCell,
  selectPlayerProgress,
  selectTurnKind,
  type GameStore,
  type PlayerProgress,
  type TurnKind,
} from "@/store/gameStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useUiStore } from "@/store/uiStore";

// P9 turns server events into these lines. Until then the log shows its empty message.
const NO_MESSAGES: readonly LogMessage[] = [];

function playerTag(player: Player, myPlayerId: string | null): keyof typeof PLAYER_TAGS | undefined {
  if (player.isAi) return "computer";
  if (!player.connected) return "offline";
  return player.id === myPlayerId ? "you" : undefined;
}

function turnText(kind: TurnKind, name: string): string {
  return kind === "human" ? TURN_TEXT.human(name) : TURN_TEXT[kind];
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

// FR-SYS-09: every part of the game fits on this one screen. P8 adds moving a piece.
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

  const { rolling, roll } = useDiceRoll(store, diceTumbleMs(animation, reducedMotion));
  useGameKeys(roll);

  const deadline = snapshot?.turn.deadline;
  const getSecondsLeft = useCallback(() => secondsUntil(deadline, Date.now()), [deadline]);

  useEffect(() => {
    if (import.meta.env.DEV) reportHomeMismatches(progress);
  }, [progress]);

  const turn: TurnDisplay | null =
    turnKind && activePlayer
      ? {
          colour: activePlayer.colour,
          text: turnText(turnKind, activePlayer.name),
          thinking: turnKind === "computer",
        }
      : null;

  const statusPlayers: StatusPanelPlayer[] = progress.map(({ player, counts }) => ({
    id: player.id,
    colour: player.colour,
    name: player.name,
    tag: playerTag(player, myPlayerId),
    counts,
    active: player.id === snapshot?.turn.activePlayerId,
  }));

  return (
    <div className="flex min-h-dvh flex-col lg:h-dvh">
      <TopBar
        turn={turn}
        sound={sound}
        onSoundChange={setSound}
        onRules={() => openModal("rules")}
        onSettings={() => openModal("settings")}
      />

      {/* Always on the page, because a screen reader only announces changes to a live region. */}
      <p aria-live="polite" className="sr-only">
        {isMyTurn ? GAME_TEXT.yourTurn : ""}
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
              tweenSeconds={pieceTweenSeconds(animation, reducedMotion)}
            />
          </Board>
          <DicePanel
            value={snapshot.turn.lastRoll}
            rolling={rolling}
            canRoll={canRoll}
            onRoll={roll}
            sixesInRow={snapshot.rules.threeSixesForfeit ? snapshot.turn.sixesInRow : null}
            getSecondsLeft={snapshot.rules.turnTimerSeconds === 0 ? null : getSecondsLeft}
            totalSeconds={snapshot.rules.turnTimerSeconds}
            showTimeUp={isMyTurn}
            className="col-start-1 row-start-2 lg:col-start-3 lg:row-start-1"
          />
          <Card className="col-span-2 row-start-3 lg:col-span-1 lg:col-start-3 lg:row-start-2 lg:min-h-0 lg:overflow-y-auto">
            <MessageLog messages={NO_MESSAGES} />
          </Card>
        </main>
      )}
    </div>
  );
}
