import { describe, expect, it } from "vitest";

import {
  buildModeStatCards,
  buildSweetheartStatCards,
  formatLocalReportDate,
  formatNovelsComparison,
  formatReplyTime,
  formatSpanLabel,
  formatWordCountWithNovels,
} from "../src/lib/reportPresentation";
import { REPORT_MODES } from "../src/lib/modePresets";
import { createTestGenerateInput } from "./reportTestData";

describe("Sweetheart report presentation", () => {
  it("formats report dates directly in the preserved local calendar frame", () => {
    expect(formatLocalReportDate("2024-08-12")).toBe("12 Aug 2024");
    expect(formatLocalReportDate("not-a-date")).toBe("not-a-date");
  });

  it("builds four designed stat cards only when they carry real signal", () => {
    const cards = buildSweetheartStatCards(createTestGenerateInput().stats);

    expect(cards).toHaveLength(4);
    expect(cards.map((card) => card.label)).toEqual([
      "texts first",
      "avg reply",
      "midnight–4am",
      "main character",
    ]);
    expect(cards.every((card) => card.value.length > 0 && card.detail.length > 0)).toBe(true);
  });

  it("builds four deterministic stats selected for every mode", () => {
    const stats = createTestGenerateInput().stats;

    for (const mode of REPORT_MODES) {
      const cards = buildModeStatCards(mode, stats);
      expect(cards).toHaveLength(4);
      expect(cards.every((card) => card.value.length > 0 && card.detail.length > 0)).toBe(true);
    }
  });

  it("replaces flat or zero-signal slots with meaningful metrics from the pool", () => {
    const input = createTestGenerateInput("roast");
    const stats = {
      ...input.stats,
      people: input.stats.people.map((person) => ({
        ...person,
        messageShare: 0.5,
        replyCount: 0,
        conversationStarts: 1,
        lateNightCount: 0,
        laughCount: 0,
        lastOfDayCount: 1,
        mediaCount: 0,
      })),
      longestSilenceDays: 0,
      totalMessages: 80,
      totalWords: 600,
      spanDays: 90,
      busiestDay: { ...input.stats.busiestDay, count: 12 },
      messagesByHour: input.stats.messagesByHour.map((count, index) => (index === 9 ? 12 : count)),
      topEmojis: [],
    };

    expect(buildModeStatCards("roast", stats)).toEqual([
      { label: "message count", value: "80", detail: "texts worth keeping receipts for" },
      { label: "word count", value: "600", detail: "a lot said out loud" },
      { label: "time together", value: "3 months", detail: "of real chat history" },
      { label: "peak traffic", value: "12", detail: formatLocalReportDate(stats.busiestDay.date) },
    ]);
  });

  it("formats spans and reply times compactly", () => {
    expect(formatSpanLabel(744)).toBe("2 years, in messages");
    expect(formatSpanLabel(90)).toBe("3 months, in messages");
    expect(formatReplyTime(0, 0)).toBe("—");
    expect(formatReplyTime(0, 12)).toBe("<1m");
    expect(formatReplyTime(90)).toBe("1.5h");
  });

  it("hides sub-novel comparisons and handles singular and plural labels", () => {
    expect(formatNovelsComparison(0)).toBeNull();
    expect(formatNovelsComparison(1)).toBe("≈ 1 novel");
    expect(formatNovelsComparison(2)).toBe("≈ 2 novels");
    expect(formatWordCountWithNovels(40_000, 0)).toBe("40,000 words");
    expect(formatWordCountWithNovels(80_000, 1)).toBe("80,000 words · ≈ 1 novel");
  });
});
