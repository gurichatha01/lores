import { describe, expect, it } from "vitest";

import { buildPlayerCards } from "../src/lib/playerCards";
import { createReportSession } from "../src/lib/reportSession";
import type { PersonStats } from "../src/lib/types";
import { createTestGenerateInput, VALID_REPORT } from "./reportTestData";

describe("people player cards", () => {
  it("grounds a person's role and verdict in their primary award", () => {
    const input = createTestGenerateInput("sweetheart");
    const report = createReportSession(input, VALID_REPORT);
    const card = buildPlayerCards(report).find(({ personName }) => personName === "A");
    const primaryAward = report.awards.find(({ who }) => who === "A")!;
    const primaryLine = VALID_REPORT.awardLines.find(({ awardId }) => awardId === primaryAward.id)!.line;

    expect(card?.role).toBe("The Overthinker");
    expect(card?.verdict).toBe(primaryLine);
    expect(card?.summary).toBe("70 messages · 70% of chat");
    expect(card?.stats).toHaveLength(3);
    expect(card?.stats.every(({ value }) => value.length > 0)).toBe(true);
  });

  it("renders deterministic defaults for a sparse participant with no award", () => {
    const input = createTestGenerateInput("family");
    const sparse: PersonStats = {
      ...input.stats.people[0],
      name: "Quiet",
      messageCount: 0,
      messageShare: 0,
      wordCount: 0,
      avgWordsPerMessage: 0,
      medianReplyTimeMin: 0,
      replyCount: 0,
      conversationStarts: 0,
      lastOfDayCount: 0,
      lateNightCount: 0,
      laughCount: 0,
      profanityMessageCount: 0,
      emojiCount: 0,
      emojisPerMessage: 0,
      linkCount: 0,
      mediaCount: 0,
      maxConsecutiveMessages: 0,
      silenceRevivalCount: 0,
      weekendMessageCount: 0,
      weekendShare: 0,
      activeSpanShare: 0,
      topEmojis: [],
      topWords: [],
    };
    const report = createReportSession(
      { ...input, stats: { ...input.stats, people: [sparse] }, awards: [] },
      { ...VALID_REPORT, awardLines: [] },
    );
    const [card] = buildPlayerCards(report);

    expect(card.role).toBe("The Constant");
    expect(card.watermarkEmoji).toBeNull();
    expect(card.signatureWords).toEqual(["no repeated words yet"]);
    expect(card.stats).toHaveLength(3);
    expect(card.secondary).toEqual([
      { label: "most-used emoji", value: "none yet" },
      { label: "total words", value: "0" },
    ]);
    expect(card.verdict).toBe("Logged 0 messages across 0 words.");
  });
});
