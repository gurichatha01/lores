import { describe, expect, it } from "vitest";

import { REPORT_MODES } from "../src/lib/modePresets";
import { createReportSession } from "../src/lib/reportSession";
import { buildShareCards } from "../src/lib/shareCards";
import { createTestGenerateInput, VALID_REPORT } from "./reportTestData";

describe("share card content", () => {
  it("creates a hero, every computed award, and a verdict for every mode", () => {
    for (const mode of REPORT_MODES) {
      const report = createReportSession(createTestGenerateInput(mode), VALID_REPORT);
      const cards = buildShareCards(report);

      expect(cards).toHaveLength(report.awards.length + 2);
      expect(cards[0]).toMatchObject({ id: "hero", kind: "hero", mode });
      expect(cards.at(-1)).toMatchObject({ id: "verdict", kind: "verdict", mode });
      expect(cards.filter((card) => card.kind === "award")).toHaveLength(report.awards.length);
      expect(new Set(cards.map((card) => card.fileName)).size).toBe(cards.length);
      expect(cards.every((card) => card.fileName.endsWith(".png"))).toBe(true);
    }
  });
});
