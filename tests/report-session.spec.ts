import { describe, expect, it } from "vitest";

import { createReportSession, parseReportSession } from "../src/lib/reportSession";
import { REPORT_MODES } from "../src/lib/modePresets";
import { createTestGenerateInput, VALID_REPORT } from "./reportTestData";

describe("report session", () => {
  it("stores only render data after generation, not the curated message sample", () => {
    const session = createReportSession(createTestGenerateInput(), VALID_REPORT);
    const serialized = JSON.stringify(session);

    expect(serialized).not.toContain('"sample"');
    expect(serialized).not.toContain('"userContext"');
    expect(parseReportSession(serialized)).toEqual(session);
  });

  it("rejects unsupported saved report fields", () => {
    const session = createReportSession(createTestGenerateInput(), VALID_REPORT);
    expect(() => parseReportSession(JSON.stringify({ ...session, rawChat: "private" }))).toThrow(
      "invalid shape",
    );
  });

  it("round-trips every supported report mode", () => {
    for (const mode of REPORT_MODES) {
      const session = createReportSession(createTestGenerateInput(mode), VALID_REPORT);
      expect(parseReportSession(JSON.stringify(session)).mode).toBe(mode);
    }
  });
});
