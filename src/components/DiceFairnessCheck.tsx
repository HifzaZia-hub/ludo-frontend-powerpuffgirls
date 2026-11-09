import { useState } from "react";
import { Button } from "@/components/Button";
import { DICE_CHECK_TEXT } from "@/feedback/copy";
import { seedMatchesHash } from "@/feedback/diceCheck";

export interface DiceFairnessCheckProps {
  seed: string; // only sent once the match is over
  seedHash: string;
}

type Outcome = "checking" | "matched" | "unknown";

const OUTCOME_TEXT: Record<Outcome, string> = {
  checking: DICE_CHECK_TEXT.checking,
  matched: `✓ ${DICE_CHECK_TEXT.matched}`,
  unknown: DICE_CHECK_TEXT.unknown,
};

export function DiceFairnessCheck({ seed, seedHash }: DiceFairnessCheckProps) {
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  async function check() {
    setOutcome("checking");
    setOutcome((await seedMatchesHash(seed, seedHash)) ? "matched" : "unknown");
  }

  if (outcome === null) {
    return (
      <Button variant="outline" size="sm" onClick={() => void check()}>
        {DICE_CHECK_TEXT.open}
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-2 text-left text-xs text-mid">
      <p aria-live="polite" className="text-[15px] font-semibold text-high">
        {OUTCOME_TEXT[outcome]}
      </p>
      <p>{DICE_CHECK_TEXT.why}</p>
      <dl className="flex flex-col gap-1">
        <dt className="font-semibold">{DICE_CHECK_TEXT.code}</dt>
        <dd className="break-all font-mono">{seedHash}</dd>
        <dt className="font-semibold">{DICE_CHECK_TEXT.secret}</dt>
        <dd className="break-all font-mono">{seed}</dd>
      </dl>
    </div>
  );
}
