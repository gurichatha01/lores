import { createCanvas } from "@napi-rs/canvas";
import { writeFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { createReportPdf, pdfFileName } from "../src/lib/createReportPdf";
import { buildPdfDocumentData, type PdfCanvas } from "../src/lib/pdfReport";
import { createReportSession } from "../src/lib/reportSession";
import { createTestGenerateInput, VALID_REPORT } from "./reportTestData";

describe("PDF keepsake", () => {
  it("maps every chart and milestone to deterministic report data", () => {
    const report = createReportSession(createTestGenerateInput("sweetheart"), VALID_REPORT);
    const data = buildPdfDocumentData(report);

    expect(data.names).toBe(report.stats.people.map((person) => person.name).join(" & "));
    expect(data.dateRange).toContain("12 Aug 2024");
    expect(data.report.stats.messagesByMonth).toEqual(report.stats.messagesByMonth);
    expect(data.report.stats.messagesByHour).toEqual(report.stats.messagesByHour);
    expect(data.report.stats.messagesByWeekday).toEqual(report.stats.messagesByWeekday);
    expect(data.report.stats.replyTimeDistribution).toEqual(report.stats.replyTimeDistribution);
    expect(data.report.stats.topEmojis).toEqual(report.stats.topEmojis);
    expect(data.storyPages.flat()).toEqual(VALID_REPORT.chapters);
    expect(Object.fromEntries(data.awardCards.map(({ award, line }) => [award.id, line]))).toEqual(
      Object.fromEntries(VALID_REPORT.awardLines.map(({ awardId, line }) => [awardId, line])),
    );
    expect(data.detailPages.flatMap((page) => page.highlights)).toEqual(VALID_REPORT.highlights);
    expect(data.detailPages.flatMap((page) => page.people)).toEqual(report.stats.people);
    expect(pdfFileName(report)).toBe("lores-sweetheart-keepsake.pdf");
  });

  it("renders a valid multi-page PDF without synthesizing chart values", async () => {
    const qaMode = process.env.PDF_QA_MODE === "sweetheart" ? "sweetheart" : "work";
    const report = createReportSession(createTestGenerateInput(qaMode), VALID_REPORT);
    report.content.highlights[0].snippet.messages[0].text = Array.from(
      { length: 90 },
      (_, index) => `receipt-word-${index + 1}`,
    ).join(" ");
    report.content.highlights = [
      report.content.highlights[0],
      {
        ...structuredClone(report.content.highlights[0]),
        label: "The follow-up",
        body: "The conversation continued with the full context intact.",
        snippet: {
          ...structuredClone(report.content.highlights[0].snippet),
          exchangeId: "exchange-02",
          messages: structuredClone(report.content.highlights[0].snippet.messages).map(
            (message, index) =>
              index === 0 ? { ...message, text: "The draft was worth staying up for." } : message,
          ),
        },
      },
      {
        ...structuredClone(report.content.highlights[0]),
        label: "The final word",
        body: "A third real exchange closes the receipt section without a sparse page.",
        snippet: {
          ...structuredClone(report.content.highlights[0].snippet),
          exchangeId: "exchange-03",
          messages: structuredClone(report.content.highlights[0].snippet.messages).map(
            (message, index) =>
              index === 0 ? { ...message, text: "That callback landed perfectly." } : message,
          ),
        },
      },
    ];
    report.stats.totalWords = 80_000;
    report.stats.novelsEquivalent = 1;
    const pdf = createReportPdf(
      report,
      (width, height) => createCanvas(width, height) as unknown as PdfCanvas,
    );
    const bytes = new Uint8Array(pdf.output("arraybuffer"));

    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    expect(pdf.getNumberOfPages()).toBe(8);
    expect(pdf.internal.pageSize.getWidth()).toBeCloseTo(210, 1);
    expect(pdf.internal.pageSize.getHeight()).toBeCloseTo(297, 1);
    expect(bytes.byteLength).toBeGreaterThan(100_000);

    if (process.env.PDF_QA_OUTPUT) {
      await writeFile(process.env.PDF_QA_OUTPUT, bytes);
    }
  }, 15_000);
});
