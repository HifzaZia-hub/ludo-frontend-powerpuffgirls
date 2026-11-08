import { useReducedMotion } from "framer-motion";
import { useEffect } from "react";
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
import { GAME_TEXT, type PLAYER_TAGS } from "@/feedback/copy";
import { pieceTweenSeconds } from "@/feedback/motion";
import {
  selectActivePlayer,
  selectPiecesByCell,
  selectPlayerProgress,
  type GameStore,
  type PlayerProgress,
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

// FR-SYS-09: every part of the game fits on this one screen. Read-only until P7 and P8.
export function GameScreen({ store }: GameScreenProps) {
  const snapshot = useStore(store, (state) => state.snapshot);
  const myPlayerId = useStore(store, (state) => state.myPlayerId);
  const activePlayer = useStore(store, selectActivePlayer);
  const progress = useStore(store, selectPlayerProgress);
  const piecesByCell = useStore(store, selectPiecesByCell);

  const openModal = useUiStore((state) => state.openModal);
  const sound = useSettingsStore((state) => state.sound);
  const setSound = useSettingsStore((state) => state.setSound);
  const animation = useSettingsStore((state) => state.animation);
  const reducedMotion = useReducedMotion() === true;

  useEffect(() => {
    if (import.meta.env.DEV) reportHomeMismatches(progress);
  }, [progress]);

  // Only a match in progress has a turn to show. P10 handles the end of a match.
  const turn: TurnDisplay | null =
    snapshot?.status === "IN_PROGRESS" && activePlayer
      ? {
          colour: activePlayer.colour,
          name: activePlayer.name,
          isMe: activePlayer.id === myPlayerId,
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
