import { assignAwards } from "../src/lib/assignAwards";
import { computeStats } from "../src/lib/computeStats";
import { serializeGenerateReportInput } from "../src/lib/reportTransport";
import { getModePreset } from "../src/lib/modePresets";
import type { GenerateReportInput, Message, ReportContent, ReportMode } from "../src/lib/types";

export const VALID_REPORT: ReportContent = {
  title: "A tiny history of us",
  heroLine: "The conversation kept finding its way back.",
  wrappedLine: "Two people, one tiny chat, and a very specific hello.",
  highlights: [
    {
      label: "The vibe",
      body: "Warm, funny, and reliably present.",
      bubble: "I remember this 😂",
    },
  ],
  awardLines: [
    { awardId: "certified-ghost", line: "The slowest reply clocked in at 5m." },
    { awardId: "main-character", line: "Took the largest share with 50% of all messages." },
    { awardId: "3am-overthinker", line: "Owned the night with 1 late-night message." },
    { awardId: "one-word-warrior", line: "Kept it shortest at 2 words per message." },
    { awardId: "comedian", line: "Led the laughs with 1 laugh-message." },
    { awardId: "the-initiator", line: "Opened the chat with 1 conversation start." },
  ],
  narrative: "Two people made a habit of showing up for one another.",
  chapters: [
    { title: "The first hello", body: "It started with a hello." },
    { title: "The five-minute reply", body: "The next message arrived five minutes later." },
    { title: "The midnight line", body: "Both messages landed just after midnight." },
    { title: "The tiny archive", body: "Two messages were enough for this fixture." },
  ],
};

export function testMessage(timestamp: Date, sender: string, text: string): Message {
  return {
    timestamp,
    sender,
    text,
    wordCount: text.match(/[\p{L}\p{N}]+/gu)?.length ?? 0,
    hasEmoji: /[😂💀❤️]/u.test(text),
    emojis: Array.from(text.matchAll(/[😂💀❤️]/gu), (match) => match[0]),
  };
}

export function createTestGenerateInput(mode: ReportMode = "sweetheart"): GenerateReportInput {
  const messages = [
    testMessage(new Date(2024, 7, 12, 0, 15, 0), "A", "I remember this 😂"),
    testMessage(new Date(2024, 7, 12, 0, 20, 0), "B", "Me too"),
  ];
  const stats = computeStats(messages);
  return serializeGenerateReportInput({
    mode,
    subtype: getModePreset(mode).defaultSubtype,
    userContext: "Together since university.",
    stats,
    awards: assignAwards(stats),
    sample: messages,
  });
}

export function geminiResponse(content: ReportContent | string): Response {
  const text = typeof content === "string" ? content : JSON.stringify(content);
  return Response.json({
    candidates: [{ content: { parts: [{ text }] } }],
  });
}
