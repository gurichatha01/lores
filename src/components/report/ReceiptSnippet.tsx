import type { ReceiptSnippet as ReceiptSnippetData } from "@/lib/types";

interface ReceiptSnippetProps {
  snippet: ReceiptSnippetData;
  accent: string;
  accentSoft: string;
  text: string;
  muted: string;
  dark?: boolean;
}

export function ReceiptSnippet({
  snippet,
  accent,
  accentSoft,
  text,
  muted,
  dark = false,
}: ReceiptSnippetProps) {
  const firstSender = snippet.messages[0]?.sender;

  return (
    <div
      className="mt-3 space-y-2"
      aria-label={`Conversation from ${formatTimestamp(snippet.startTimestamp)} to ${formatTimestamp(snippet.endTimestamp)}`}
    >
      {snippet.messages.map((message) => {
        const outgoing = message.sender !== firstSender;
        return (
          <div
            key={message.messageIndex}
            className={`flex ${outgoing ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[88%] px-3.5 py-2.5 ${
                outgoing
                  ? "rounded-[15px_15px_4px_15px]"
                  : "rounded-[15px_15px_15px_4px]"
              }`}
              style={{
                background: outgoing ? accent : accentSoft,
                color: outgoing || dark ? "#ffffff" : text,
              }}
            >
              <div className="mb-1 flex items-baseline justify-between gap-3">
                <span className="text-[10px] font-extrabold">{message.sender}</span>
                <span className="font-mono text-[8px] opacity-55">
                  {formatTimestamp(message.timestamp)}
                </span>
              </div>
              <p className="whitespace-pre-wrap break-words text-[13px] font-semibold leading-snug">
                {message.text}
              </p>
            </div>
          </div>
        );
      })}
      <p
        className="pt-1 text-center font-mono text-[8px] uppercase tracking-[0.08em]"
        style={{ color: muted }}
      >
        messages {snippet.startIndex + 1}&ndash;{snippet.endIndex + 1}
      </p>
    </div>
  );
}

function formatTimestamp(timestamp: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/u.exec(timestamp);
  if (!match) return timestamp;
  return `${match[3]}/${match[2]} · ${match[4]}:${match[5]}`;
}
