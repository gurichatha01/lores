import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { assignAwards } from "../src/lib/assignAwards";
import { computeStats } from "../src/lib/computeStats";
import { parseWhatsApp } from "../src/lib/parseWhatsApp";

const realExportPath = process.env.REAL_WHATSAPP_EXPORT;

describe.skipIf(!realExportPath)("real WhatsApp stats sanity check", () => {
  it("prints the complete deterministic stats object", async () => {
    const resolvedPath = path.resolve(realExportPath!);
    const bytes = await readFile(resolvedPath);
    const input = Object.assign(new Blob([bytes]), { name: path.basename(resolvedPath) });
    const parsed = await parseWhatsApp(input);
    const stats = computeStats(parsed);
    const awards = assignAwards(stats, stats.isGroup ? "group" : "ride-or-die");

    expect(stats.totalMessages).toBe(parsed.messages.length);
    expect(stats.totalWords).toBeGreaterThan(0);
    expect(stats.people.length).toBeGreaterThanOrEqual(2);
    expect(stats.messagesByHour).toHaveLength(24);
    expect(stats.messagesByWeekday).toHaveLength(7);
    expect(stats.messagesByMonth.length).toBeGreaterThanOrEqual(12);
    expect(stats.messagesByMonth.reduce((sum, month) => sum + month.count, 0)).toBe(stats.totalMessages);
    expect(stats.replyTimeDistribution).toHaveLength(6);
    expect(stats.replyTimeDistribution.reduce((sum, bucket) => sum + bucket.count, 0)).toBeGreaterThan(0);
    expect(stats.busiestDay.count).toBeGreaterThan(0);
    expect(stats.spanDays).toBeGreaterThan(300);
    expect(awards.length).toBeGreaterThanOrEqual(3);
    expect(awards.length).toBeLessThanOrEqual(8);

    console.info(JSON.stringify({ stats, awards }, null, 2));
  });
});
