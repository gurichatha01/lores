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
    { awardId: "certified-ghost", line: "The slowest reply clocked in at 45m." },
    { awardId: "main-character", line: "Took the largest share with 70% of all messages." },
    { awardId: "3am-overthinker", line: "Owned the night with 30 late-night messages." },
    { awardId: "one-word-warrior", line: "Kept it shortest at 2 words per message." },
    { awardId: "comedian", line: "Led the laughs with 40 laugh-messages." },
    { awardId: "the-initiator", line: "Opened the chat with 70 conversation starts." },
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
  const computed = computeStats(messages);
  const stats = {
    ...computed,
    totalMessages: 100,
    people: computed.people.map((person) =>
      person.name === "A"
        ? {
            ...person,
            messageCount: 70,
            messageShare: 0.7,
            avgWordsPerMessage: 8,
            medianReplyTimeMin: 5,
            conversationStarts: 70,
            lateNightCount: 30,
            laughCount: 40,
          }
        : {
            ...person,
            messageCount: 30,
            messageShare: 0.3,
            avgWordsPerMessage: 2,
            medianReplyTimeMin: 45,
            conversationStarts: 20,
            lateNightCount: 5,
            laughCount: 3,
          },
    ),
  };
  return serializeGenerateReportInput({
    mode,
    subtype: getModePreset(mode).defaultSubtype,
    userContext: "Together since university.",
    stats,
    awards: assignAwards(stats, mode),
    sample: messages,
  });
}

export function createTiedGenerateInput(mode: ReportMode = "sweetheart"): GenerateReportInput {
  const input = createTestGenerateInput(mode);
  input.stats.people = input.stats.people.map((person) => ({
    ...person,
    medianReplyTimeMin: 45,
  }));
  input.awards = assignAwards(input.stats, mode);
  return input;
}

export const TIED_REPORT: ReportContent = {
  ...VALID_REPORT,
  awardLines: VALID_REPORT.awardLines.map((line) =>
    line.awardId === "certified-ghost"
      ? { ...line, line: "Shared a tied median reply of 45m." }
      : line,
  ),
};

export function createAlternateGenerateInput(
  mode: ReportMode = "sweetheart",
): GenerateReportInput {
  const input = createTestGenerateInput(mode);
  input.stats.longestStreakDays = 11;
  input.stats.people = input.stats.people.map((person) =>
    person.name === "A"
      ? {
          ...person,
          messageCount: 53,
          messageShare: 0.53,
          avgWordsPerMessage: 5.1,
          medianReplyTimeMin: 1,
          conversationStarts: 174,
          lateNightCount: 259,
          laughCount: 143,
        }
      : {
          ...person,
          messageCount: 47,
          messageShare: 0.47,
          avgWordsPerMessage: 4.2,
          medianReplyTimeMin: 1,
          conversationStarts: 140,
          lateNightCount: 152,
          laughCount: 121,
        },
  );
  input.awards = assignAwards(input.stats, mode);
  return input;
}

export const ALTERNATE_REPORT: ReportContent = {
  ...VALID_REPORT,
  awardLines: [
    { awardId: "3am-overthinker", line: "Owned the night with 259 late-night messages." },
    { awardId: "comedian", line: "Led the laughs with 143 laugh-messages." },
    { awardId: "perfectly-in-sync", line: "Matched the reply rhythm at a shared 1m." },
    { awardId: "two-way-street", line: "Kept a balanced 53% / 47% message split." },
    { awardId: "the-metronome", line: "Kept everyone showing up for an 11-day streak." },
  ],
};

export function geminiResponse(content: unknown): Response {
  const text = typeof content === "string" ? content : JSON.stringify(content);
  return Response.json({
    candidates: [{ content: { parts: [{ text }] } }],
  });
}
