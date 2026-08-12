import { describe, expect, it } from "vitest";

import { assignAwards } from "../src/lib/assignAwards";
import { computeStats, REPLY_GAP_CAP_MIN } from "../src/lib/computeStats";
import { parseWhatsAppText } from "../src/lib/parseWhatsApp";
import type { Message } from "../src/lib/types";

function message(timestamp: string, sender: string, text = "hello"): Message {
  const words = text.match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu) ?? [];
  const emojis = Array.from(
    text.matchAll(
      /(?:\p{Regional_Indicator}{2}|[#*0-9]\uFE0F?\u20E3|\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?\p{Emoji_Modifier}?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?\p{Emoji_Modifier}?)*)/gu,
    ),
    (match) => match[0],
  );

  return {
    timestamp: new Date(timestamp),
    sender,
    text,
    wordCount: words.length,
    hasEmoji: emojis.length > 0,
    emojis,
  };
}

function person(stats: ReturnType<typeof computeStats>, name: string) {
  return stats.people.find((candidate) => candidate.name === name)!;
}

describe("computeStats", () => {
  it("keeps naive WhatsApp timestamps in the local wall-clock day near midnight", () => {
    const parsed = parseWhatsAppText(
      [
        "[11/08/24, 11:55:00 PM] B: before midnight",
        "[12/08/24, 12:15:00 AM] A: after midnight",
        "[12/08/24, 12:20:00 AM] B: still after midnight",
      ].join("\n"),
    );
    const nearMidnight = parsed.messages[1].timestamp;
    const stats = computeStats(parsed);

    expect(nearMidnight.getHours()).toBe(0);
    expect(nearMidnight.toISOString()).toBe("2024-08-11T18:45:00.000Z");
    expect(stats.messagesByHour[0]).toBe(2);
    expect(stats.messagesByWeekday[0]).toBe(2); // Monday, 12 August locally.
    expect(stats.messagesByWeekday[6]).toBe(1); // Sunday, 11 August locally.
    expect([
      stats.busiestDay.date.getFullYear(),
      stats.busiestDay.date.getMonth(),
      stats.busiestDay.date.getDate(),
    ]).toEqual([2024, 7, 12]);
  });

  it("computes reply medians only on sender changes and caps overnight gaps", () => {
    const stats = computeStats([
      message("2024-01-01T09:00:00", "A"),
      message("2024-01-01T09:02:00", "A"),
      message("2024-01-01T09:12:00", "B"), // B replies in 10m
      message("2024-01-01T09:32:00", "A"), // A replies in 20m
      message("2024-01-01T16:32:01", "B"), // >6h: new conversation, not a reply
      message("2024-01-01T16:37:01", "A"), // A replies in 5m
      message("2024-01-01T16:52:01", "B"), // B replies in 15m
    ]);

    expect(REPLY_GAP_CAP_MIN).toBe(360);
    expect(person(stats, "A").medianReplyTimeMin).toBe(12.5);
    expect(person(stats, "B").medianReplyTimeMin).toBe(12.5);
    expect(person(stats, "A").conversationStarts).toBe(1);
    expect(person(stats, "B").conversationStarts).toBe(1);
    expect(stats.replyTimeDistribution).toEqual([
      { label: "<1m", count: 0 },
      { label: "1-5m", count: 1 },
      { label: "5-30m", count: 3 },
      { label: "30m-2h", count: 0 },
      { label: "2-4h", count: 0 },
      { label: "4-6h", count: 0 },
    ]);
  });

  it("requires every participant on consecutive days for the longest streak", () => {
    const stats = computeStats([
      message("2024-02-01T09:00:00", "A"),
      message("2024-02-01T10:00:00", "B"),
      message("2024-02-01T11:00:00", "C"),
      message("2024-02-02T09:00:00", "A"),
      message("2024-02-02T10:00:00", "B"),
      message("2024-02-02T11:00:00", "C"),
      message("2024-02-03T09:00:00", "A"),
      message("2024-02-03T10:00:00", "B"), // C missing: breaks streak
      message("2024-02-04T09:00:00", "A"),
      message("2024-02-04T10:00:00", "B"),
      message("2024-02-04T11:00:00", "C"),
    ]);

    expect(stats.isGroup).toBe(true);
    expect(stats.longestStreakDays).toBe(2);
  });

  it("finds the busiest calendar day and resolves ties to the earliest date", () => {
    const stats = computeStats([
      message("2024-03-01T10:00:00", "A"),
      message("2024-03-02T10:00:00", "A"),
      message("2024-03-02T10:01:00", "B"),
      message("2024-03-03T10:00:00", "A"),
      message("2024-03-03T10:01:00", "B"),
    ]);

    expect(stats.busiestDay.count).toBe(2);
    expect([
      stats.busiestDay.date.getFullYear(),
      stats.busiestDay.date.getMonth(),
      stats.busiestDay.date.getDate(),
    ]).toEqual([2024, 2, 2]);
  });

  it("computes volume, timeline, timing, dynamics, language, and media fields", () => {
    const stats = computeStats(
      {
        mediaCount: 4,
        messages: [
          message("2024-04-01T00:30:00", "A", "Hahaha project project 😂"),
          message("2024-04-01T08:00:00", "B", "Morning status update 👍"),
          message("2024-04-01T23:00:00", "A", "good night 💀"),
          message("2024-04-04T12:00:00", "B", "project shipped lol 👍"),
        ],
      },
    );

    expect(stats).toMatchObject({
      isGroup: false,
      totalMessages: 4,
      totalWords: 11,
      novelsEquivalent: 0,
      mediaCount: 4,
      spanDays: 4,
      longestSilenceDays: 2,
      goodMorningCount: 1,
      iLoveYouCount: 0,
    });
    expect(stats.messagesByHour).toHaveLength(24);
    expect(stats.messagesByHour[0]).toBe(1);
    expect(stats.messagesByHour[8]).toBe(1);
    expect(stats.messagesByHour[23]).toBe(1);
    expect(stats.messagesByWeekday).toHaveLength(7);
    expect(stats.messagesByWeekday.reduce((sum, count) => sum + count, 0)).toBe(4);
    expect(stats.messagesByMonth).toEqual([{ month: "2024-04", count: 4 }]);
    expect(stats.topEmojis).toEqual([
      { emoji: "👍", count: 2 },
      { emoji: "😂", count: 1 },
      { emoji: "💀", count: 1 },
    ]);
    expect(stats.firstLateNightDate?.getHours()).toBe(0);
    expect(stats.firstRelationshipTalkDate).toBeNull();
    expect(stats.longestSilenceRange).toMatchObject({ days: 2 });
    expect(stats.longestSilenceRange?.startDate.getDate()).toBe(2);
    expect(stats.longestSilenceRange?.endDate.getDate()).toBe(3);
    expect(person(stats, "A")).toMatchObject({
      messageCount: 2,
      messageShare: 0.5,
      wordCount: 5,
      avgWordsPerMessage: 2.5,
      lateNightCount: 1,
      laughCount: 3,
      lastOfDayCount: 1,
      topEmojis: [
        { emoji: "😂", count: 1 },
        { emoji: "💀", count: 1 },
      ],
    });
    expect(person(stats, "A").topWords.slice(0, 2)).toEqual(["project", "hahaha"]);
    expect(person(stats, "B")).toMatchObject({
      messageCount: 2,
      messageShare: 0.5,
      wordCount: 6,
      avgWordsPerMessage: 3,
      laughCount: 1,
      lastOfDayCount: 1,
      topEmojis: [{ emoji: "👍", count: 2 }],
    });
  });

  it("sorts unsorted input and rejects empty chats", () => {
    const stats = computeStats([
      message("2024-05-02T10:00:00", "B"),
      message("2024-05-01T10:00:00", "A"),
    ]);

    expect(stats.firstMessageDate.getDate()).toBe(1);
    expect(stats.lastMessageDate.getDate()).toBe(2);
    expect(stats.spanDays).toBe(2);
    expect(() => computeStats([])).toThrow("without messages");
  });

  it("excludes URL fragments and common function words from top words", () => {
    const stats = computeStats([
      message("2024-05-03T10:00:00", "A", "hai project https://google.com/path project"),
      message("2024-05-03T10:01:00", "B", "the launch"),
    ]);

    expect(person(stats, "A").topWords).toEqual(["project"]);
    expect(person(stats, "B").topWords).toEqual(["launch"]);
  });

  it("fills zero-message months and computes phrase and milestone counts from message text", () => {
    const stats = computeStats([
      message("2024-01-31T09:00:00", "A", "Good morning, I love you"),
      message("2024-03-02T02:15:00", "B", "what are we"),
      message("2024-03-02T02:20:00", "A", "love you too"),
    ]);

    expect(stats.messagesByMonth).toEqual([
      { month: "2024-01", count: 1 },
      { month: "2024-02", count: 0 },
      { month: "2024-03", count: 2 },
    ]);
    expect(stats.goodMorningCount).toBe(1);
    expect(stats.iLoveYouCount).toBe(2);
    expect(stats.firstLateNightDate?.getDate()).toBe(2);
    expect(stats.firstRelationshipTalkDate?.getHours()).toBe(2);
  });

  it("buckets every qualifying reply boundary and excludes gaps over six hours", () => {
    const stats = computeStats([
      message("2024-01-01T00:00:00", "A"),
      message("2024-01-01T00:00:30", "B"),
      message("2024-01-02T00:00:00", "A"),
      message("2024-01-02T00:05:00", "B"),
      message("2024-01-03T00:00:00", "A"),
      message("2024-01-03T00:06:00", "B"),
      message("2024-01-04T00:00:00", "A"),
      message("2024-01-04T02:00:00", "B"),
      message("2024-01-05T00:00:00", "A"),
      message("2024-01-05T04:00:00", "B"),
      message("2024-01-06T00:00:00", "A"),
      message("2024-01-06T06:00:00", "B"),
      message("2024-01-07T00:00:00", "A"),
      message("2024-01-07T06:00:01", "B"),
    ]);

    expect(stats.replyTimeDistribution).toEqual([
      { label: "<1m", count: 1 },
      { label: "1-5m", count: 1 },
      { label: "5-30m", count: 1 },
      { label: "30m-2h", count: 1 },
      { label: "2-4h", count: 1 },
      { label: "4-6h", count: 1 },
    ]);
  });
});

describe("assignAwards", () => {
  it("maps each deterministic metric to the expected award winner", () => {
    const stats = computeStats([
      message("2024-06-01T00:30:00", "A", "lol 😂"),
      message("2024-06-01T00:35:00", "B", "ok"),
      message("2024-06-01T01:00:00", "A", "hahaha project update"),
      message("2024-06-01T01:45:00", "B", "k"),
      message("2024-06-01T02:00:00", "A", "rofl project update details"),
      message("2024-06-01T02:50:00", "B", "sure"),
      message("2024-06-01T12:00:00", "A", "starting again after lunch"),
      message("2024-06-01T12:01:00", "B", "yes"),
      message("2024-06-02T12:00:00", "A", "starting the next day"),
    ]);

    expect(Object.fromEntries(assignAwards(stats).map((award) => [award.id, award.who]))).toEqual({
      "certified-ghost": "B",
      "main-character": "A",
      "3am-overthinker": "A",
      "one-word-warrior": "B",
      comedian: "A",
      "the-initiator": "A",
    });
  });

  it("resolves tied metrics by participant appearance order", () => {
    const stats = computeStats([
      message("2024-07-01T10:00:00", "First", "hello"),
      message("2024-07-01T10:01:00", "Second", "hello"),
    ]);

    expect(assignAwards(stats).find((award) => award.id === "main-character")?.who).toBe("First");
  });
});
