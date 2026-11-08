import { Card } from "@/components/Card";
import { Dice } from "@/components/Dice";

const doNothing = () => undefined;

export interface DicePanelProps {
  value: number | null; // always the server's turn.lastRoll
  className?: string;
}

// P7 connects the roll. For now it can only show what the server last rolled (NFR-SYS-05).
export function DicePanel({ value, className = "" }: DicePanelProps) {
  return (
    <Card className={`flex items-center justify-center ${className}`}>
      <Dice value={value} rolling={false} disabled onRoll={doNothing} />
    </Card>
  );
}
