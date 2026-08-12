import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { parseWhatsApp } from "../src/lib/parseWhatsApp";
import { formatLocalDateTime } from "../src/lib/reportTransport";

const realExportPath = process.env.REAL_WHATSAPP_EXPORT;

describe.skipIf(!realExportPath)("real WhatsApp export sanity check", () => {
  it("produces believable aggregate counts without exposing message text", async () => {
    const resolvedPath = path.resolve(realExportPath!);
    const bytes = await readFile(resolvedPath);
    const input = Object.assign(new Blob([bytes]), { name: path.basename(resolvedPath) });
    const result = await parseWhatsApp(input);
    const senders = new Map<string, number>();

    for (const message of result.messages) {
      senders.set(message.sender, (senders.get(message.sender) ?? 0) + 1);
      expect(message.sender).not.toBe("");
      expect(message.text).not.toBe("");
      expect(Number.isNaN(message.timestamp.getTime())).toBe(false);
    }

    const first = result.messages[0]?.timestamp;
    const last = result.messages.at(-1)?.timestamp;
    const spanDays = first && last ? Math.round((last.getTime() - first.getTime()) / 86_400_000) : 0;

    expect(result.messages.length).toBeGreaterThan(0);
    expect(senders.size).toBeGreaterThanOrEqual(2);
    expect(spanDays).toBeGreaterThan(365);
    expect(result.mediaCount).toBeGreaterThanOrEqual(0);

    // Aggregates only: never print raw chat content from the private fixture.
    console.info({
      totalMessages: result.messages.length,
      mediaCount: result.mediaCount,
      participantCount: senders.size,
      messagesPerParticipant: [...senders.values()].sort((left, right) => right - left),
      firstMessageLocal: first ? formatLocalDateTime(first) : undefined,
      lastMessageLocal: last ? formatLocalDateTime(last) : undefined,
      spanDays,
    });
  });
});
