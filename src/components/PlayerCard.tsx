import { Card } from "@/components/Card";
import { PlayerMark } from "@/components/PlayerMark";
import type { Colour } from "@/contract/types";
import { LABELS, PLAYER_TAGS } from "@/feedback/copy";

export interface PlayerCardCounts {
  base: number;
  track: number;
  home: number;
}

export interface PlayerCardProps {
  colour: Colour;
  name: string;
  tag?: keyof typeof PLAYER_TAGS;
  counts: PlayerCardCounts;
  active?: boolean;
}

export function PlayerCard({ colour, name, tag, counts, active = false }: PlayerCardProps) {
  const columns = [
    { label: LABELS.base, count: counts.base },
    { label: LABELS.track, count: counts.track },
    { label: LABELS.home, count: counts.home },
  ];

  return (
    <Card active={active} aria-current={active || undefined}>
      <div className="flex items-center gap-2">
        <PlayerMark colour={colour} />
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold text-high">{name}</p>
          {tag && <p className="text-xs text-mid">{PLAYER_TAGS[tag]}</p>}
        </div>
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
        {columns.map(({ label, count }) => (
          <div key={label}>
            <dt className="text-xs font-semibold uppercase text-low">{label}</dt>
            <dd className="text-xl font-semibold text-high">{count}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
