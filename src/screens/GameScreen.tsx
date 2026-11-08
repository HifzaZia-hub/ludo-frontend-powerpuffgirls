import { useStore } from "zustand";
import { FOCUS_RING } from "@/components/focusRing";
import { PlayerMark } from "@/components/PlayerMark";
import { GAME_TEXT } from "@/feedback/copy";
import type { GameStore } from "@/store/gameStore";

export interface GameScreenProps {
  store: GameStore;
}

// A stand-in so the lobby has somewhere to land. P6 replaces all of it with the real game screen.
export function GameScreen({ store }: GameScreenProps) {
  const players = useStore(store, (state) => state.snapshot?.players ?? null);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-4 pt-16">
      <h1 tabIndex={-1} className={`text-[32px] font-bold ${FOCUS_RING}`}>
        {GAME_TEXT.title}
      </h1>
      {/* Contract §4: GAME_STARTED arrives before the first game:state. */}
      <p role="status" className="text-[15px] text-mid">
        {players === null ? GAME_TEXT.loading : GAME_TEXT.boardComing}
      </p>
      {players && (
        <ul className="flex flex-col gap-2">
          {players.map((player) => (
            <li key={player.id} className="flex items-center gap-2 text-[15px] text-high">
              <PlayerMark colour={player.colour} size="sm" />
              {player.name}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
