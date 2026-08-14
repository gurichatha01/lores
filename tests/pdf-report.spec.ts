import { createCanvas } from "@napi-rs/canvas";
import { writeFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { createReportPdf, pdfFileName } from "../src/lib/createReportPdf";
import { buildPdfDocumentData, type PdfCanvas } from "../src/lib/pdfReport";
import { createReportSession } from "../src/lib/reportSession";
import { isReportMode } from "../src/lib/modePresets";
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
    expect(data.storyTimeline).toHaveLength(VALID_REPORT.chapters.length);
    expect(data.storyTimeline[0].date).toBe(report.stats.firstMessageDate.slice(0, 10));
    expect(data.storyTimeline.at(-1)?.date).toBe(report.stats.lastMessageDate.slice(0, 10));
    expect(Object.fromEntries(data.awardCards.map(({ award, line }) => [award.id, line]))).toEqual(
      Object.fromEntries(VALID_REPORT.awardLines.map(({ awardId, line }) => [awardId, line])),
    );
    expect(data.detailPages.flatMap((page) => page.highlights)).toEqual(VALID_REPORT.highlights);
    expect(data.detailPages.flatMap((page) => page.people)).toEqual(report.stats.people);
    expect(pdfFileName(report)).toBe("lores-sweetheart-keepsake.pdf");
  });

  it("renders a valid multi-page PDF without synthesizing chart values", async () => {
    const qaMode = isReportMode(process.env.PDF_QA_MODE) ? process.env.PDF_QA_MODE : "work";
    const report = createReportSession(createTestGenerateInput(qaMode), VALID_REPORT);
    if (process.env.PDF_QA_PULL_QUOTE) {
      (report.content.highlights[0] as (typeof report.content.highlights)[number] & { bubble?: string }).bubble =
        "One ridiculous night, preserved in four messages.";
    }
    if (process.env.PDF_QA_STORY_TIMELINE) {
      report.stats.firstMessageDate = "2021-01-10";
      report.stats.lastMessageDate = "2025-01-09";
      report.stats.spanDays = 1_461;
      report.stats.busiestDay = { date: "2023-09-18", count: 143 };
      report.content.chapters = Array.from({ length: 12 }, (_, index) => ({
        title: `Chapter ${index + 1}: ${VALID_REPORT.chapters[index % VALID_REPORT.chapters.length].title}`,
        body: VALID_REPORT.chapters[index % VALID_REPORT.chapters.length].body,
      }));
    }
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
    expect(pdf.getNumberOfPages()).toBe(
      // cover + narrative spread + numbers + awards + receipts/people + story + closing
      9 + (process.env.PDF_QA_PULL_QUOTE ? 1 : 0) + (process.env.PDF_QA_STORY_TIMELINE ? 1 : 0),
    );
    expect(pdf.internal.pageSize.getWidth()).toBeCloseTo(210, 1);
    expect(pdf.internal.pageSize.getHeight()).toBeCloseTo(297, 1);
    expect(bytes.byteLength).toBeGreaterThan(100_000);

    if (process.env.PDF_QA_OUTPUT) {
      await writeFile(process.env.PDF_QA_OUTPUT, bytes);
    }
  }, 15_000);

  it("includes the leaderboard page for group reports and excludes it for two-person modes", () => {
    const groupInput = createTestGenerateInput("group");
    groupInput.stats.isGroup = true;
    groupInput.stats.people = [
      ...groupInput.stats.people,
      {
        ...groupInput.stats.people[0],
        name: "Person 3",
        messageCount: 50,
        messageShare: 0.25,
        wordCount: 300,
        medianReplyTimeMin: 15,
        replyCount: 10,
        conversationStarts: 10,
        conversationStartCount: 10,
        soloRate: 0.1,
        threadKillerCount: 5,
        ghostStreakCount: 2,
        responseRate: 0.33,
      },
    ];
    const groupReport = createReportSession(groupInput, VALID_REPORT);
    const groupPdf = createReportPdf(
      groupReport,
      (width, height) => createCanvas(width, height) as unknown as PdfCanvas,
    );

    const sweetheartReport = createReportSession(createTestGenerateInput("sweetheart"), VALID_REPORT);
    const sweetheartPdf = createReportPdf(
      sweetheartReport,
      (width, height) => createCanvas(width, height) as unknown as PdfCanvas,
    );

    // Group mode has the extra leaderboard page before closing
    // Sweetheart has 7 pages (cover, narrative, metrics, awards, detail, story, closing)
    // Group mode with 3 people has the leaderboard page
    expect(groupPdf.getNumberOfPages()).toBeGreaterThan(sweetheartPdf.getNumberOfPages());
  }, 25_000);
});
