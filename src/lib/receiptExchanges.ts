import { formatLocalDateTime } from "./reportTransport";
import type { Message, ReceiptExchange } from "./types";

const MAX_EXCHANGES = 12;
const MIN_MESSAGES = 3;
const MAX_MESSAGES = 6;
const MAX_EXCHANGE_GAP_MS = 6 * 60 * 60 * 1_000;
const MEANINGFUL_TEXT = /[\p{L}\p{N}]/u;
const MEDIA_ONLY = /^\s*(?:<media omitted>|image omitted|video omitted|audio omitted|sticker omitted|document omitted|gif omitted)\s*$/iu;

/**
 * Build a small set of real, consecutive conversation chains around the
 * already-curated evidence. The model chooses one ID; it never constructs or
 * pairs message text itself.
 */
export function buildReceiptExchanges(
  messages: readonly Message[],
  sample: readonly Message[],
): ReceiptExchange[] {
  if (messages.length < MIN_MESSAGES || sample.length === 0) return [];

  const chronological = messages
    .map((message, sourceIndex) => ({ message, sourceIndex }))
    .sort(
      (left, right) =>
        left.message.timestamp.getTime() - right.message.timestamp.getTime() ||
        left.sourceIndex - right.sourceIndex,
    );
  const candidateAnchors = sample
    .map((message) => findMessageIndex(chronological, message))
    .filter((index): index is number => index !== null);
  const anchors = evenlySpacedUnique(candidateAnchors, MAX_EXCHANGES * 2);
  const exchanges: ReceiptExchange[] = [];
  const usedRanges: Array<[number, number]> = [];

  for (const anchor of anchors) {
    const range = conversationWindow(chronological, anchor);
    if (!range || usedRanges.some(([start, end]) => range.start <= end && range.end >= start)) {
      continue;
    }
    const entries = chronological.slice(range.start, range.end + 1);
    if (!isUsefulExchange(entries.map((entry) => entry.message))) continue;

    const startTimestamp = formatLocalDateTime(entries[0].message.timestamp);
    const endTimestamp = formatLocalDateTime(entries.at(-1)!.message.timestamp);
    exchanges.push({
      exchangeId: `exchange-${String(exchanges.length + 1).padStart(2, "0")}`,
      startIndex: entries[0].sourceIndex,
      endIndex: entries.at(-1)!.sourceIndex,
      startTimestamp,
      endTimestamp,
      messages: entries.map(({ message, sourceIndex }) => ({
        messageIndex: sourceIndex,
        timestamp: formatLocalDateTime(message.timestamp),
        sender: message.sender,
        text: message.text.trim(),
      })),
    });
    usedRanges.push([range.start, range.end]);
    if (exchanges.length >= MAX_EXCHANGES) break;
  }

  return exchanges;
}

function findMessageIndex(
  messages: readonly { message: Message; sourceIndex: number }[],
  target: Message,
): number | null {
  const timestamp = target.timestamp.getTime();
  const index = messages.findIndex(
    ({ message }) =>
      message.timestamp.getTime() === timestamp &&
      message.sender === target.sender &&
      (message.text === target.text || message.text.includes(target.text)),
  );
  return index >= 0 ? index : null;
}

function conversationWindow(
  messages: readonly { message: Message }[],
  anchor: number,
): { start: number; end: number } | null {
  let segmentStart = anchor;
  let segmentEnd = anchor;
  while (
    segmentStart > 0 &&
    messages[segmentStart].message.timestamp.getTime() -
      messages[segmentStart - 1].message.timestamp.getTime() <=
      MAX_EXCHANGE_GAP_MS
  ) {
    segmentStart -= 1;
  }
  while (
    segmentEnd < messages.length - 1 &&
    messages[segmentEnd + 1].message.timestamp.getTime() -
      messages[segmentEnd].message.timestamp.getTime() <=
      MAX_EXCHANGE_GAP_MS
  ) {
    segmentEnd += 1;
  }
  if (segmentEnd - segmentStart + 1 < MIN_MESSAGES) return null;

  const start = Math.max(segmentStart, Math.min(anchor - 2, segmentEnd - MAX_MESSAGES + 1));
  const end = Math.min(segmentEnd, start + MAX_MESSAGES - 1);
  return end - start + 1 >= MIN_MESSAGES ? { start, end } : null;
}

function isUsefulExchange(messages: readonly Message[]): boolean {
  const meaningful = messages.filter(
    (message) => MEANINGFUL_TEXT.test(message.text) && !MEDIA_ONLY.test(message.text),
  );
  return meaningful.length >= 2 && new Set(messages.map((message) => message.sender)).size >= 2;
}

function evenlySpacedUnique(values: readonly number[], limit: number): number[] {
  const unique = [...new Set(values)];
  if (unique.length <= limit) return unique;
  return Array.from({ length: limit }, (_, slot) =>
    unique[Math.floor((slot * (unique.length - 1)) / (limit - 1))],
  );
}
