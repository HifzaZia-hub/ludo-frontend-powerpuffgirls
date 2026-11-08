import { Button } from "@/components/Button";
import { PlayerMark } from "@/components/PlayerMark";
import type { Colour, Player } from "@/contract/types";
import { COLOUR_NAMES, LOBBY_TEXT, PLAYER_TAGS } from "@/feedback/copy";

export interface SeatRowProps {
  colour: Colour;
  player: Player | null;
  isHost: boolean;
  isMe: boolean;
  /** Only the host may fill an empty seat. Everyone else sees that it is waiting. */
  canAddComputer: boolean;
  adding: boolean;
  addDisabled: boolean;
  onAddComputer: () => void;
}

export function SeatRow({
  colour,
  player,
  isHost,
  isMe,
  canAddComputer,
  adding,
  addDisabled,
  onAddComputer,
}: SeatRowProps) {
  return (
    <li className="flex min-h-[3rem] items-center gap-3 rounded-lg border border-soft bg-raised px-3 py-1">
      <PlayerMark colour={colour} />
      {player ? (
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2">
          <span className="truncate text-[15px] font-semibold text-high">{player.name}</span>
          {isMe && <span className="text-xs text-mid">({PLAYER_TAGS.you})</span>}
          {player.isAi && <span className="text-xs text-mid">{PLAYER_TAGS.computer}</span>}
          {isHost && (
            <span className="text-xs text-mid">
              <span aria-hidden="true">♛ </span>
              {LOBBY_TEXT.host}
            </span>
          )}
        </div>
      ) : canAddComputer ? (
        <Button
          variant="outline"
          size="sm"
          pending={adding}
          disabled={addDisabled}
          // Each row's button needs its own name, or a screen reader hears the same one each time.
          aria-label={LOBBY_TEXT.addComputerAs(COLOUR_NAMES[colour])}
          onClick={onAddComputer}
        >
          {LOBBY_TEXT.addComputer}
        </Button>
      ) : (
        <span className="text-[15px] text-mid">{LOBBY_TEXT.waitingForPlayer}</span>
      )}
    </li>
  );
}
