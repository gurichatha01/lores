import { describe, expect, it } from "vitest";

import { REPORT_MODES } from "../src/lib/modePresets";
import { createReportSession } from "../src/lib/reportSession";
import { buildWrappedCard } from "../src/lib/wrappedCard";
import { createTestGenerateInput, VALID_REPORT } from "./reportTestData";

describe("Wrapped card content", () => {
  it("builds exactly one self-contained card per mode from engine and report values", () => {
    for (const mode of REPORT_MODES) {
      const input = createTestGenerateInput(mode);
      const report = createReportSession(input, VALID_REPORT);
      const card = buildWrappedCard(report);

      expect(card.mode).toBe(mode);
      expect(card.relationshipLine).toContain(input.stats.people[0].name);
      expect(card.heroValue).toBe(input.stats.totalMessages.toLocaleString("en-US"));
      expect(card.heroDetail).toBe(`${input.stats.totalWords.toLocaleString("en-US")} words`);
      expect(card.stats).toHaveLength(4);
      expect(card.headlineAward).toEqual(
        input.awards.find((award) => award.id === "main-character"),
      );
      expect(card.punchLine).toBe(VALID_REPORT.heroLine);
      expect(card.fileName).toBe(`lore-${mode}-wrapped.png`);
    }
  });

  it("does not manufacture an award when the engine provides none", () => {
    const report = createReportSession(createTestGenerateInput(), VALID_REPORT);
    report.awards = [];

    expect(() => buildWrappedCard(report)).toThrow("computed award");
  });
});
