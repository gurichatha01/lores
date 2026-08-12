import { describe, expect, it } from "vitest";

import {
  buildSweetheartStatCards,
  formatLocalReportDate,
  formatReplyTime,
  formatSpanLabel,
} from "../src/lib/reportPresentation";
import { createTestGenerateInput } from "./reportTestData";

describe("Sweetheart report presentation", () => {
  it("formats report dates directly in the preserved local calendar frame", () => {
    expect(formatLocalReportDate("2024-08-12")).toBe("12 Aug 2024");
    expect(formatLocalReportDate("not-a-date")).toBe("not-a-date");
  });

  it("builds the four designed stat cards only from deterministic stats", () => {
    const cards = buildSweetheartStatCards(createTestGenerateInput().stats);

    expect(cards).toHaveLength(4);
    expect(cards.map((card) => card.label)).toEqual([
      "texts first",
      "avg reply",
      "longest streak",
      "midnight–4am",
    ]);
    expect(cards.every((card) => card.value.length > 0 && card.detail.length > 0)).toBe(true);
  });

  it("formats spans and reply times compactly", () => {
    expect(formatSpanLabel(744)).toBe("2 years, in messages");
    expect(formatSpanLabel(90)).toBe("3 months, in messages");
    expect(formatReplyTime(0)).toBe("—");
    expect(formatReplyTime(90)).toBe("1.5h");
  });
});
