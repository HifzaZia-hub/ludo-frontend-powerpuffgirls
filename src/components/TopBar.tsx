import { Button } from "@/components/Button";
import { FOCUS_RING } from "@/components/focusRing";
import { GameMenu } from "@/components/GameMenu";
import { PlayerMark } from "@/components/PlayerMark";
import { Toggle } from "@/components/Toggle";
import type { Colour } from "@/contract/types";
import { GAME_TEXT, MAIN_TEXT, SETTINGS_TEXT } from "@/feedback/copy";

const THINKING_DOT_DELAYS = ["0ms", "150ms", "300ms"];

export interface TurnDisplay {
  colour: Colour;
  text: string;
  thinking: boolean;
}

export interface TopBarProps {
  turn: TurnDisplay | null;
  sound: boolean;
  onSoundChange: (sound: boolean) => void;
  onRules: () => void;
  onSettings: () => void;
  canRestart: boolean;
  onRestart: () => void;
  onLeave: () => void;
}

export function TopBar({
  turn,
  sound,
  onSoundChange,
  onRules,
  onSettings,
  canRestart,
  onRestart,
  onLeave,
}: TopBarProps) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-soft bg-panel px-3 py-2">
      <div className="flex items-center gap-2">
        {/* App moves focus here when the game opens (NFR-SYS-08). */}
        <h1 tabIndex={-1} className={`text-xl font-bold text-high ${FOCUS_RING}`}>
          {MAIN_TEXT.wordmark}
        </h1>
        <GameMenu canRestart={canRestart} onRestart={onRestart} onLeave={onLeave} />
        <Button variant="ghost" size="sm" onClick={onRules}>
          <span aria-hidden="true">?</span>
          {GAME_TEXT.rules}
        </Button>
      </div>

      {/* FR-SYS-02 POST-02-1: says whose turn it is in words, with a mark that isn't only a colour. */}
      {turn && (
        <p className="flex min-w-0 items-center gap-2 text-[15px] font-semibold text-high">
          <PlayerMark colour={turn.colour} size="sm" />
          <span className="truncate">{turn.text}</span>
          {/* FR-SYS-07: the server runs the computer player, and this only shows it is busy. */}
          {turn.thinking && (
            <span aria-hidden="true" data-thinking="" className="flex items-center gap-1">
              {THINKING_DOT_DELAYS.map((delay) => (
                <span
                  key={delay}
                  style={{ animationDelay: delay }}
                  className="h-1.5 w-1.5 animate-thinking rounded-full bg-mid"
                />
              ))}
            </span>
          )}
        </p>
      )}

      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onSettings}>
          <span aria-hidden="true">{"⚙︎"}</span>
          {SETTINGS_TEXT.title}
        </Button>
        <Toggle label={GAME_TEXT.sound} checked={sound} onChange={onSoundChange} />
      </div>
    </header>
  );
}
