import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { FOCUS_RING } from "@/components/focusRing";
import { GAME_TEXT, moveCardText } from "@/feedback/copy";

export interface MoveListItem {
  pieceId: string;
  number: string;
  phrase: string;
}

export interface MoveListProps {
  moves: readonly MoveListItem[];
  selectedId: string | null;
  locked: boolean;
  sending: boolean;
  onPick: (pieceId: string) => void;
  onPreview: (pieceId: string) => void;
  onConfirm: () => void;
}

// docs/03-ui-spec.md S5: the same choices as the board, for players who find the board fiddly.
export function MoveList({
  moves,
  selectedId,
  locked,
  sending,
  onPick,
  onPreview,
  onConfirm,
}: MoveListProps) {
  return (
    <Card className="p-3">
      <section aria-label={GAME_TEXT.yourMoves} className="flex flex-col gap-2">
        <ul className="flex flex-col gap-1">
          {moves.map(({ pieceId, number, phrase }) => {
            const selected = pieceId === selectedId;
            return (
              <li key={pieceId}>
                <button
                  type="button"
                  aria-pressed={selected}
                  aria-disabled={locked || undefined}
                  onClick={() => {
                    if (!locked) onPick(pieceId);
                  }}
                  onFocus={() => onPreview(pieceId)}
                  className={`flex w-full items-center gap-2 rounded-xl border px-3 py-1 text-left text-sm text-high aria-disabled:cursor-not-allowed ${
                    selected ? "border-accent bg-raised font-semibold" : "border-soft"
                  } ${FOCUS_RING}`}
                >
                  {/* NFR-SYS-07: a tick as well as the border colour. */}
                  <span aria-hidden="true" className="w-3 shrink-0">
                    {selected ? "✓" : ""}
                  </span>
                  {moveCardText(number, phrase)}
                </button>
              </li>
            );
          })}
        </ul>
        <Button
          className="w-full"
          disabled={selectedId === null || (locked && !sending)}
          pending={sending}
          onClick={onConfirm}
        >
          {GAME_TEXT.move}
        </Button>
      </section>
    </Card>
  );
}
