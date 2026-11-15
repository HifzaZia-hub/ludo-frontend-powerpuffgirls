import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { FOCUS_RING } from "@/components/focusRing";
import { CONNECTION_TEXT } from "@/feedback/copy";

export interface SessionReplacedCardProps {
  onPlayHere: () => void;
}

// Contract §7: takes the place of the screen, so this tab can't act until the player chooses it.
export function SessionReplacedCard({ onPlayHere }: SessionReplacedCardProps) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-4 p-4">
      <Card className="flex flex-col items-center gap-4 text-center">
        <h1 tabIndex={-1} className={`text-xl font-bold text-high ${FOCUS_RING}`}>
          {CONNECTION_TEXT.replaced}
        </h1>
        <Button onClick={onPlayHere}>{CONNECTION_TEXT.playHere}</Button>
      </Card>
    </main>
  );
}
