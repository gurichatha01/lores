import { describe, expect, it } from "vitest";

import { parseGenerateReportInput } from "../src/lib/reportValidation";
import { createTestGenerateInput } from "./reportTestData";

describe("report transport", () => {
  it("preserves local midnight instead of serializing dates as UTC instants", () => {
    const input = createTestGenerateInput();

    expect(input.stats.firstMessageDate).toBe("2024-08-12T00:15:00");
    expect(input.stats.busiestDay.date).toBe("2024-08-12");
    expect(input.sample[0].timestamp).toBe("2024-08-12T00:15:00");
    expect(input.sample[0].timestamp).not.toContain("Z");
    expect(input.stats.firstLateNightDate).toBe("2024-08-12T00:15:00");
    expect(input.stats.firstRelationshipTalkDate).toBeNull();
    expect(parseGenerateReportInput(JSON.parse(JSON.stringify(input)))).toEqual(input);
  });

  it("rejects UTC timestamps and unsupported fields such as an uncurated chat", () => {
    const withUtc = structuredClone(createTestGenerateInput());
    withUtc.sample[0].timestamp = "2024-08-11T18:45:00.000Z";
    expect(() => parseGenerateReportInput(withUtc)).toThrow("local wall-clock");

    const withExtraField = {
      ...createTestGenerateInput(),
      rawChat: "the complete export must never cross this boundary",
    };
    expect(() => parseGenerateReportInput(withExtraField)).toThrow("unsupported field");
  });
});
