import { describe, expect, it } from "vitest";

import { assignAwards } from "../src/lib/assignAwards";
import { computeStats } from "../src/lib/computeStats";
import { buildPdfDocumentData } from "../src/lib/pdfReport";
import { formatParticipantTitle, formatSpanLabel } from "../src/lib/reportPresentation";
import { createReportSession } from "../src/lib/reportSession";
import { serializeGenerateReportInput } from "../src/lib/reportTransport";
import { buildWrappedCard } from "../src/lib/wrappedCard";
import type { Message, PersonStats, ReportContent } from "../src/lib/types";

const names = Array.from({ length: 9 }, (_, index) => `Person ${index + 1}`);

function message(index: number): Message {
  return {
    timestamp: new Date(2025, 0, index + 1, 12, 0),
    sender: names[index],
    text: `message number ${index + 1}`,
    wordCount: 3,
    hasEmoji: false,
    emojis: [],
  };
}

function groupPeople(): PersonStats[] {
  const stats = computeStats(names.map((_, index) => message(index)));
  return stats.people.map((person, index) => ({
    ...person,
    messageCount: index === 0 ? 10 : 100,
    messageShare: index === 0 ? 0.005 : 0.124,
    avgWordsPerMessage: index === 1 ? 15 : 5,
    medianReplyTimeMin: index === 2 ? 1 : 20,
    replyCount: index === 2 ? 50 : 20,
    emojiCount: index === 3 ? 100 : 0,
    emojisPerMessage: index === 3 ? 1 : 0,
    linkCount: index === 4 ? 10 : 0,
    mediaCount: index === 4 ? 20 : 0,
    maxConsecutiveMessages: index === 5 ? 20 : 1,
    silenceRevivalCount: index === 6 ? 5 : 0,
    weekendMessageCount: index === 7 ? 100 : 10,
    weekendShare: index === 7 ? 1 : 0.1,
    activeSpanShare: 1,
    lateNightCount: 0,
    laughCount: 0,
    conversationStarts: 10,
  }));
}

function groupReport() {
  const computed = computeStats(names.map((_, index) => message(index)));
  const stats = { ...computed, people: groupPeople(), totalMessages: 810, spanDays: 365 };
  const awards = assignAwards(stats);
  const content: ReportContent = {
    title: "The group report",
    heroLine: "Nine people kept this chat moving.",
    wrappedLine: "One group, nine distinct chat habits.",
    highlights: [],
    awardLines: awards.map((award) => ({ awardId: award.id, line: award.detail })),
    narrative: "A deterministic group fixture.",
    chapters: [
      { title: "One", body: "The first chapter." },
      { title: "Two", body: "The second chapter." },
      { title: "Three", body: "The third chapter." },
      { title: "Four", body: "The fourth chapter." },
    ],
  };
  const input = serializeGenerateReportInput({
    mode: "group",
    subtype: "group chat",
    userContext: "",
    stats,
    awards,
    sample: names.map((_, index) => message(index)),
  });
  return createReportSession(input, content);
}

describe("group report integrity", () => {
  it("qualifies the group award pool, ranks by strength, and never exceeds eight", () => {
    const awards = assignAwards({ people: groupPeople(), longestStreakDays: 0 });
    expect(new Set(awards.map((award) => award.id))).toEqual(new Set([
      "the-lurker",
      "the-novelist",
      "reply-guy",
      "emoji-addict",
      "the-broadcaster",
      "the-double-texter",
      "the-reviver",
      "weekend-warrior",
    ]));
    expect(awards).toHaveLength(8);
    expect(new Set(awards.map((award) => award.who)).size).toBe(8);
  });

  it("never grants two-person balance awards or overflowing recipient lists to a group", () => {
    const people = groupPeople().map((person) => ({
      ...person,
      messageShare: 1 / 9,
      medianReplyTimeMin: 2,
    }));
    const awards = assignAwards({ people, longestStreakDays: 12 });
    expect(awards.map((award) => award.id)).not.toEqual(
      expect.arrayContaining(["perfectly-in-sync", "two-way-street"]),
    );
    expect(awards.every((award) => names.includes(award.who) || award.who === "the group" || award.who === "all 9 of you")).toBe(true);
    expect(awards.every((award) => !award.who.includes(" & "))).toBe(true);
  });

  it("lists every participant once in unified PDF cards with no cutoff", () => {
    const data = buildPdfDocumentData(groupReport());
    expect(data.peoplePages.flat().map((person) => person.name)).toEqual(names);
    expect(data.peoplePages).toHaveLength(2);
    expect(data.peoplePages[0]).toHaveLength(8);
    expect(data.peoplePages[1]).toHaveLength(1);
  });

  it("uses compact group titles and one consistent date span across surfaces", () => {
    const report = groupReport();
    const pdf = buildPdfDocumentData(report);
    const card = buildWrappedCard(report);
    const title = formatParticipantTitle(report.stats.people);
    const span = formatSpanLabel(report.stats.spanDays).replace(", in messages", "");

    expect(title).toBe("Person 1 & 8 others");
    expect(pdf.names).toBe(title);
    expect(pdf.span).toBe(span);
    expect(card.relationshipLine).toBe(`${title} · ${span}`);
    expect(card.editionLabel).toBe("Group Wrapped");
  });
});
