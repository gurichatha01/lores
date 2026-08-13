import { describe, expect, it } from "vitest";

import { buildReceiptExchanges } from "../src/lib/receiptExchanges";
import type { Message } from "../src/lib/types";

function message(index: number, sender: string, text: string): Message {
  return {
    timestamp: new Date(2025, 4, 1, 12, index),
    sender,
    text,
    wordCount: text.match(/[\p{L}\p{N}]+/gu)?.length ?? 0,
    hasEmoji: !/[\p{L}\p{N}]/u.test(text),
    emojis: [],
  };
}

describe("receipt exchanges", () => {
  it("builds a real consecutive 3-6 message source range around curated evidence", () => {
    const messages = [
      message(0, "A", "Did you finish the story?"),
      message(1, "B", "Yes, but the ending needs another pass."),
      message(2, "A", "The middle was my favourite part."),
      message(3, "B", "That is exactly the section I nearly deleted."),
      message(4, "A", "Keep it. The character finally sounds honest there."),
      message(5, "B", "Fine, the critic wins this round."),
      message(6, "A", "Now fix the title."),
    ];

    const [exchange] = buildReceiptExchanges(messages, [messages[3]]);

    expect(exchange.messages).toHaveLength(6);
    expect(exchange.messages.map((item) => item.messageIndex)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(exchange.startIndex).toBe(1);
    expect(exchange.endIndex).toBe(6);
    expect(exchange.messages.map((item) => item.text)).toEqual(
      messages.slice(1, 7).map((item) => item.text),
    );
  });

  it("does not offer emoji/media-only chains as receipts", () => {
    const messages = [
      message(0, "A", "😂"),
      message(1, "B", "<Media omitted>"),
      message(2, "A", "👍"),
      message(3, "B", "😂😂"),
    ];

    expect(buildReceiptExchanges(messages, messages)).toEqual([]);
  });
});
