import { describe, expect, it } from "vitest";

import { parseReportContent } from "../src/lib/reportValidation";
import { VALID_REPORT } from "./reportTestData";

describe("report display punctuation", () => {
  it("normalizes generated long dashes while preserving source receipt messages", () => {
    const report = structuredClone(VALID_REPORT);
    report.title = "One chat — two eras";
    report.heroLine = "From 2024–2026 — still talking";
    report.highlights[0].body = "A plan — then a detour";
    report.highlights[0].snippet.messages[0].text = "This — came from the real chat";

    const parsed = parseReportContent(report);

    expect(parsed.title).toBe("One chat, two eras");
    expect(parsed.heroLine).toBe("From 2024-2026, still talking");
    expect(parsed.highlights[0].body).toBe("A plan, then a detour");
    expect(parsed.highlights[0].snippet.messages[0].text).toBe(
      "This — came from the real chat",
    );
  });
});
