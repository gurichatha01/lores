import { describe, expect, it } from "vitest";

import { getModePreset, MODE_PRESETS, REPORT_MODES } from "../src/lib/modePresets";
import { parseGenerateReportInput } from "../src/lib/reportValidation";
import { createTestGenerateInput } from "./reportTestData";

describe("report mode presets", () => {
  it("defines the six locked design modes with distinct accent colors", () => {
    expect(REPORT_MODES).toEqual([
      "sweetheart",
      "ride-or-die",
      "group",
      "family",
      "work",
      "roast",
    ]);
    expect(new Set(REPORT_MODES.map((mode) => getModePreset(mode).accent))).toHaveLength(6);
    expect(Object.keys(MODE_PRESETS).sort()).toEqual([...REPORT_MODES].sort());
  });

  it("keeps one placeholder voice and four deterministic stat slots per mode", () => {
    for (const mode of REPORT_MODES) {
      const preset = getModePreset(mode);
      expect(preset.placeholderVoice.length).toBeGreaterThan(10);
      expect(preset.statMetrics).toHaveLength(4);
      expect(parseGenerateReportInput(createTestGenerateInput(mode)).mode).toBe(mode);
    }
  });
});
