import { describe, expect, it } from "vitest";

import { buildReceiptPresentation, formatExchangeDuration } from "../src/lib/receiptPresentation";
import type { ReportContent } from "../src/lib/types";
import { VALID_REPORT } from "./reportTestData";

describe("PDF receipt presentation", () => {
  it("derives the strip from the displayed exchange only", () => {
    const receipt = buildReceiptPresentation(VALID_REPORT.highlights[0]);

    expect(receipt.messages).toHaveLength(4);
    expect(receipt.statLine).toBe("4 messages · 13m · A sent first");
    expect(receipt.pullQuote).toBeNull();
  });

  it("uses a legacy bubble only when it is not already visible", () => {
    const highlight = structuredClone(VALID_REPORT.highlights[0]) as ReportContent["highlights"][number] & {
      bubble?: string;
    };
    highlight.bubble = "The callback that became the whole story.";
    expect(buildReceiptPresentation(highlight).pullQuote).toBe(highlight.bubble);

    highlight.bubble = highlight.snippet.messages[0].text;
    expect(buildReceiptPresentation(highlight).pullQuote).toBeNull();
  });

  it("cleanly omits additions for an empty exchange", () => {
    const highlight = structuredClone(VALID_REPORT.highlights[0]);
    highlight.snippet.messages = [];

    expect(buildReceiptPresentation(highlight)).toEqual({
      messages: [],
      statLine: null,
      pullQuote: null,
    });
  });

  it("formats wall-clock exchange durations without timezone conversion", () => {
    expect(formatExchangeDuration("2024-08-12T23:55:00", "2024-08-13T01:10:00")).toBe("1h 15m");
    expect(formatExchangeDuration("bad", "also bad")).toBe("0m");
  });
});
