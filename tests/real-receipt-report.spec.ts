import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { assignAwards } from "../src/lib/assignAwards";
import { computeStats } from "../src/lib/computeStats";
import { curateSample } from "../src/lib/curateSample";
import { generateReport } from "../src/lib/llm";
import { parseWhatsApp } from "../src/lib/parseWhatsApp";
import { buildReceiptExchanges } from "../src/lib/receiptExchanges";
import { serializeGenerateReportInput } from "../src/lib/reportTransport";

const runRealReceiptReport = process.env.RUN_REAL_RECEIPT_REPORT === "1";
const exportPath = process.env.REAL_WHATSAPP_EXPORT;

describe.skipIf(!runRealReceiptReport || !exportPath)("live receipt report", () => {
  it("keeps real candidate exchanges through Gemini selection and materialization", async () => {
    const resolvedPath = path.resolve(exportPath!);
    const bytes = await readFile(resolvedPath);
    const file = Object.assign(new Blob([bytes]), { name: path.basename(resolvedPath) });
    const parsed = await parseWhatsApp(file);
    const stats = computeStats(parsed);
    const sample = curateSample(parsed.messages);
    const receiptExchanges = buildReceiptExchanges(parsed.messages, sample);
    const input = serializeGenerateReportInput({
      mode: "ride-or-die",
      subtype: "close friend",
      userContext: "",
      stats,
      awards: assignAwards(stats, "ride-or-die"),
      sample,
      receiptExchanges,
    });

    console.info("[lores receipts] live input", {
      parsedMessageCount: parsed.messages.length,
      curatedSampleCount: sample.length,
      receiptExchangeCount: input.receiptExchanges.length,
      exchangeIds: input.receiptExchanges.map((exchange) => exchange.exchangeId),
    });

    const content = await generateReport(input);
    const offered = new Map(
      input.receiptExchanges.map((exchange) => [exchange.exchangeId, exchange]),
    );

    console.info("[lores receipts] live output", {
      highlightCount: content.highlights.length,
      selectedExchangeIds: content.highlights.map(
        (highlight) => highlight.snippet.exchangeId,
      ),
      renderedMessageCounts: content.highlights.map(
        (highlight) => highlight.snippet.messages.length,
      ),
    });

    expect(input.receiptExchanges.length).toBeGreaterThan(0);
    expect(content.highlights.length).toBeGreaterThan(0);
    for (const highlight of content.highlights) {
      expect(highlight.snippet).toEqual(offered.get(highlight.snippet.exchangeId));
      expect(highlight.snippet.messages.length).toBeGreaterThanOrEqual(3);
      expect(highlight.snippet.messages.length).toBeLessThanOrEqual(6);
    }
  }, 120_000);
});
