import { PlayerCard, type PlayerCardProps } from "@/components/PlayerCard";
import { GAME_TEXT } from "@/feedback/copy";

export interface StatusPanelPlayer extends PlayerCardProps {
  id: string;
}

export interface StatusPanelProps {
  players: readonly StatusPanelPlayer[];
  className?: string;
}

// FR-SYS-06: shows counts it is given. It never works out who is ahead or who has won.
export function StatusPanel({ players, className = "" }: StatusPanelProps) {
  return (
    <section aria-label={GAME_TEXT.players} className={className}>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
        {players.map(({ id, ...card }) => (
          <li key={id}>
            <PlayerCard {...card} />
          </li>
        ))}
      </ul>
    </section>
  );
}
