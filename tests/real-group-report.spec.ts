import { createCanvas } from "@napi-rs/canvas";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { assignAwards } from "../src/lib/assignAwards";
import { computeStats } from "../src/lib/computeStats";
import { createReportPdf } from "../src/lib/createReportPdf";
import { curateSample } from "../src/lib/curateSample";
import { generateReport } from "../src/lib/llm";
import { parseWhatsApp } from "../src/lib/parseWhatsApp";
import { type PdfCanvas } from "../src/lib/pdfReport";
import { createReportSession } from "../src/lib/reportSession";
import { serializeGenerateReportInput } from "../src/lib/reportTransport";

const runRealGroup = process.env.RUN_REAL_GROUP_REPORT === "1";
const exportPath = process.env.REAL_WHATSAPP_EXPORT;

describe.skipIf(!runRealGroup || !exportPath)("live 9-person group report", () => {
  it("generates and exports the real report and keepsake PDF", async () => {
    const resolvedPath = path.resolve(exportPath!);
    const bytes = await readFile(resolvedPath);
    const file = Object.assign(new Blob([bytes]), { name: path.basename(resolvedPath) });
    const parsed = await parseWhatsApp(file);
    const stats = computeStats(parsed);
    const awards = assignAwards(stats);
    const input = serializeGenerateReportInput({
      mode: "group",
      subtype: "friend group",
      userContext: "Nine-person group chat.",
      stats,
      awards,
      sample: curateSample(parsed.messages),
    });
    const content = await generateReport(input);
    const report = createReportSession(input, content);
    const pdf = createReportPdf(
      report,
      (width, height) => createCanvas(width, height) as unknown as PdfCanvas,
    );
    const outputDir = path.resolve("output/pdf");
    await mkdir(outputDir, { recursive: true });
    await writeFile(
      path.join(outputDir, "lores-viet-dong-group-report.json"),
      JSON.stringify(report, null, 2),
    );
    await writeFile(
      path.join(outputDir, "lores-viet-dong-group-keepsake.pdf"),
      new Uint8Array(pdf.output("arraybuffer")),
    );

    expect(stats.people).toHaveLength(9);
    expect(awards.length).toBeGreaterThanOrEqual(4);
    expect(awards.length).toBeLessThanOrEqual(8);
    expect(content.awardLines).toHaveLength(awards.length);
    expect(pdf.getNumberOfPages()).toBeGreaterThanOrEqual(7);
    console.info(JSON.stringify({ stats, awards, content }, null, 2));
  }, 120_000);
});
