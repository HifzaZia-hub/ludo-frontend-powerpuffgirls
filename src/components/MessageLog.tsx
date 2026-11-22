import { Icon } from "@/components/Icon";
import { LABELS } from "@/feedback/copy";

const MAX_PREVIOUS = 8;

export interface LogMessage {
  id: string | number;
  text: string;
}

export interface MessageLogProps {
  /** Oldest first, the same order as the store's event log. */
  messages: readonly LogMessage[];
}

// FR-SYS-05 EXC-05-1: this only shows the lines it is given and never makes one up.
export function MessageLog({ messages }: MessageLogProps) {
  const latest = messages[messages.length - 1];
  const previous = messages.slice(-1 - MAX_PREVIOUS, -1).reverse();

  return (
    <section aria-label={LABELS.messages} className="flex flex-col gap-2">
      <p aria-live="polite" className="flex items-start gap-2 text-xl font-semibold text-high">
        {latest && (
          <span key={`icon-${latest.id}`} className="pop-in mt-1 flex shrink-0">
            <Icon name="rocket" className="h-5 w-5 text-[var(--title-accent)]" />
          </span>
        )}
        {/* A new key for each message, so the newest one slides up into place. */}
        <span key={`text-${latest?.id ?? "none"}`} className="swap-in">
          {latest ? latest.text : LABELS.noMessages}
        </span>
      </p>
      <ol className="flex flex-col gap-1 text-[15px] text-mid">
        {previous.map((message) => (
          <li key={message.id} className="slide-in">
            {message.text}
          </li>
        ))}
      </ol>
    </section>
  );
}
