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
      <p aria-live="polite" className="text-xl font-semibold text-high">
        {latest ? latest.text : LABELS.noMessages}
      </p>
      <ol className="flex flex-col gap-1 text-[15px] text-mid">
        {previous.map((message) => (
          <li key={message.id}>{message.text}</li>
        ))}
      </ol>
    </section>
  );
}
