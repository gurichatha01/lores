import type { ReportContent, ReceiptSnippetMessage } from "./types";

export interface ReceiptPresentation {
  messages: ReceiptSnippetMessage[];
  statLine: string | null;
  pullQuote: string | null;
}

type Highlight = ReportContent["highlights"][number];

export function buildReceiptPresentation(highlight: Highlight): ReceiptPresentation {
  const messages = (highlight.snippet?.messages ?? []).filter(
    (message) => typeof message.text === "string" && message.text.trim().length > 0,
  );
  if (messages.length === 0) {
    return { messages: [], statLine: null, pullQuote: null };
  }

  const first = messages[0];
  const last = messages.at(-1)!;
  const duration = formatExchangeDuration(first.timestamp, last.timestamp);
  const statLine = `${messages.length} ${messages.length === 1 ? "message" : "messages"} · ${duration} · ${first.sender || "unknown"} sent first`;
  const legacyBubble = readLegacyBubble(highlight);
  const fallback = [...messages]
    .reverse()
    .reduce((longest, message) =>
      message.text.trim().length > longest.length ? message.text.trim() : longest,
    "");
  const candidate = (legacyBubble || fallback).trim();
  const visibleLines = new Set(messages.map((message) => normalizeLine(message.text)));
  const pullQuote = candidate && !visibleLines.has(normalizeLine(candidate)) ? candidate : null;

  return { messages, statLine, pullQuote };
}

export function formatExchangeDuration(firstTimestamp: string, lastTimestamp: string): string {
  const first = parseWallClock(firstTimestamp);
  const last = parseWallClock(lastTimestamp);
  if (first === null || last === null || last <= first) return "0m";

  const totalMinutes = Math.max(1, Math.round((last - first) / 60_000));
  if (totalMinutes < 60) return `${totalMinutes}m`;
  if (totalMinutes < 1_440) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  const days = Math.floor(totalMinutes / 1_440);
  const hours = Math.floor((totalMinutes % 1_440) / 60);
  return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
}

function readLegacyBubble(highlight: Highlight): string {
  const value = (highlight as Highlight & { bubble?: unknown }).bubble;
  return typeof value === "string" ? value.trim() : "";
}

function parseWallClock(timestamp: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/u.exec(timestamp);
  if (!match) return null;
  const parts = match.slice(1).map(Number);
  if (parts.some((part) => !Number.isFinite(part))) return null;
  return Date.UTC(parts[0], parts[1] - 1, parts[2], parts[3], parts[4], parts[5] ?? 0);
}

function normalizeLine(value: string): string {
  return value.replace(/\s+/gu, " ").trim().toLocaleLowerCase();
}
