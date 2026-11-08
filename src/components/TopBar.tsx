import { Button } from "@/components/Button";
import { FOCUS_RING } from "@/components/focusRing";
import { PlayerMark } from "@/components/PlayerMark";
import { Toggle } from "@/components/Toggle";
import type { Colour } from "@/contract/types";
import { GAME_TEXT, MAIN_TEXT, SETTINGS_TEXT } from "@/feedback/copy";

export interface TurnDisplay {
  colour: Colour;
  name: string;
  isMe: boolean;
}

export interface TopBarProps {
  turn: TurnDisplay | null;
  sound: boolean;
  onSoundChange: (sound: boolean) => void;
  onRules: () => void;
  onSettings: () => void;
}

export function TopBar({ turn, sound, onSoundChange, onRules, onSettings }: TopBarProps) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-soft bg-panel px-3 py-2">
      <div className="flex items-center gap-2">
        {/* App moves focus here when the game opens (NFR-SYS-08). */}
        <h1 tabIndex={-1} className={`text-xl font-bold text-high ${FOCUS_RING}`}>
          {MAIN_TEXT.wordmark}
        </h1>
        {/* P10 adds Restart and Leave. Until then there is nothing for this to open. */}
        <Button variant="ghost" size="sm" disabled>
          {/* U+FE0E asks for the plain glyph, so it takes the theme's text colour. */}
          <span aria-hidden="true">{"☰︎"}</span>
          {GAME_TEXT.menu}
        </Button>
        <Button variant="ghost" size="sm" onClick={onRules}>
          <span aria-hidden="true">?</span>
          {GAME_TEXT.rules}
        </Button>
      </div>

      {/* FR-SYS-02: says whose turn it is in words, with a mark that isn't only a colour. */}
      {turn && (
        <p className="flex min-w-0 items-center gap-2 text-[15px] font-semibold text-high">
          <span className="text-mid">{GAME_TEXT.turn}</span>
          <PlayerMark colour={turn.colour} size="sm" />
          <span className="truncate">{turn.name}</span>
          {turn.isMe && <span className="text-mid">{GAME_TEXT.you}</span>}
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
