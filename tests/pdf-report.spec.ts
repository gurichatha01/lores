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
    expect(pdfFileName(report)).toBe("lore-sweetheart-keepsake.pdf");
  });

  it("renders a valid multi-page PDF without synthesizing chart values", async () => {
    const report = createReportSession(createTestGenerateInput("work"), VALID_REPORT);
    const pdf = createReportPdf(
      report,
      (width, height) => createCanvas(width, height) as unknown as PdfCanvas,
    );
    const bytes = new Uint8Array(pdf.output("arraybuffer"));

    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    expect(pdf.getNumberOfPages()).toBe(5);
    expect(pdf.internal.pageSize.getWidth()).toBeCloseTo(210, 1);
    expect(pdf.internal.pageSize.getHeight()).toBeCloseTo(297, 1);
    expect(bytes.byteLength).toBeGreaterThan(100_000);

    if (process.env.PDF_QA_OUTPUT) {
      await writeFile(process.env.PDF_QA_OUTPUT, bytes);
    }
  });
});
