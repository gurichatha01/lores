import { describe, expect, it } from "vitest";

import { assignAwards, AWARD_THRESHOLDS } from "../src/lib/assignAwards";
import {
  computeStats,
  NO_REPLY_MEDIAN_MIN,
  REPLY_GAP_CAP_MIN,
} from "../src/lib/computeStats";
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

  it("returns complete finite defaults for link, media, and blank-only participants", () => {
    const stats = computeStats({
      messages: [
        message("2024-01-01T09:00:00", "Sparse", "https://example.com/only-a-link"),
        message("2024-01-01T09:01:00", "Sparse", ""),
        message("2024-01-01T18:00:00", "Words", "A countable message"),
      ],
      mediaCount: 4,
      mediaBySender: { Sparse: 2, "Media only": 2 },
    });

    for (const name of ["Sparse", "Media only"]) {
      const sparse = person(stats, name);
      expect(sparse.topWords).toEqual([]);
      expect(sparse.topEmojis).toEqual([]);
      expect(sparse.avgWordsPerMessage).toBe(0);
      expect(sparse.medianReplyTimeMin).toBe(NO_REPLY_MEDIAN_MIN);
      const numericValues = Object.values(sparse).filter(
        (value): value is number => typeof value === "number",
      );
      expect(numericValues.every(Number.isFinite)).toBe(true);
    }

    expect(person(stats, "Sparse")).toMatchObject({
      messageCount: 2,
      wordCount: 0,
      linkCount: 1,
      mediaCount: 2,
    });
    expect(person(stats, "Media only")).toMatchObject({
      messageCount: 0,
      messageShare: 0,
      wordCount: 0,
      emojisPerMessage: 0,
      weekendShare: 0,
      activeSpanShare: 0,
      mediaCount: 2,
    });
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

  it("retains the per-person signals used by group awards", () => {
    const parsed = parseWhatsAppText([
      "05/01/2024, 10:00 - A: https://example.com look 😂",
      "05/01/2024, 10:01 - A: second message 😂",
      "05/01/2024, 10:02 - A: <Media omitted>",
      "05/01/2024, 10:03 - B: reply",
      "06/01/2024, 10:00 - B: weekend one",
      "06/01/2024, 10:01 - C: weekend reply",
      "08/01/2024, 12:00 - C: bringing this back",
    ].join("\n"));
    const stats = computeStats(parsed);

    expect(person(stats, "A")).toMatchObject({
      emojiCount: 2,
      emojisPerMessage: 1,
      linkCount: 1,
      mediaCount: 1,
      maxConsecutiveMessages: 2,
    });
    expect(person(stats, "C")).toMatchObject({
      replyCount: 1,
      silenceRevivalCount: 1,
      weekendMessageCount: 1,
    });
    expect(person(stats, "B").weekendShare).toBe(0.5);
    expect(person(stats, "A").activeSpanShare).toBeGreaterThan(0);
  });
});

describe("assignAwards", () => {
  it("maps every qualifying primary metric to the expected winner and detail", () => {
    const computed = computeStats([
      message("2024-06-01T09:00:00", "A"),
      message("2024-06-01T09:01:00", "B"),
    ]);
    const stats = {
      ...computed,
      people: computed.people.map((candidate) =>
        candidate.name === "A"
          ? {
              ...candidate,
              messageCount: 70,
              messageShare: 0.7,
              avgWordsPerMessage: 8,
              medianReplyTimeMin: 5,
              conversationStarts: 70,
              lateNightCount: 30,
              laughCount: 40,
            }
          : {
              ...candidate,
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

    const awards = assignAwards(stats);
    expect(Object.fromEntries(awards.map((award) => [award.id, award.who]))).toEqual({
      "certified-ghost": "B",
      "main-character": "A",
      "3am-overthinker": "A",
      "one-word-warrior": "B",
      comedian: "A",
      "the-initiator": "A",
    });
    expect(Object.fromEntries(awards.map((award) => [award.id, award.detail]))).toEqual({
      "certified-ghost": "median reply 45m",
      "main-character": "70% of all messages",
      "3am-overthinker": "30 late-night messages",
      "one-word-warrior": "2 words per message",
      comedian: "40 laugh-messages",
      "the-initiator": "70 conversation starts",
    });
    expect(person(stats, "B").medianReplyTimeMin).toBeGreaterThan(
      person(stats, "A").medianReplyTimeMin,
    );
    expect(person(stats, "A").messageShare).toBeGreaterThan(person(stats, "B").messageShare);
    expect(person(stats, "A").lateNightCount).toBeGreaterThan(person(stats, "B").lateNightCount);
    expect(person(stats, "B").avgWordsPerMessage).toBeLessThan(
      person(stats, "A").avgWordsPerMessage,
    );
    expect(person(stats, "A").laughCount).toBeGreaterThan(person(stats, "B").laughCount);
    expect(person(stats, "A").conversationStarts).toBeGreaterThan(
      person(stats, "B").conversationStarts,
    );
  });

  it("omits primary awards at their exact boundaries and fills with fitting alternates", () => {
    const computed = computeStats([
      message("2024-06-01T09:00:00", "A"),
      message("2024-06-01T09:01:00", "B"),
      message("2024-06-02T09:00:00", "A"),
      message("2024-06-02T09:01:00", "B"),
    ]);
    const stats = {
      ...computed,
      longestStreakDays: AWARD_THRESHOLDS.metronomeMinStreakDays,
      people: computed.people.map((candidate, index) => ({
        ...candidate,
        messageCount: 50,
        messageShare: 0.5,
        avgWordsPerMessage: AWARD_THRESHOLDS.oneWordMaxAverageExclusive,
        medianReplyTimeMin: AWARD_THRESHOLDS.certifiedGhostMinMinutesExclusive,
        conversationStarts: 3,
        lateNightCount: AWARD_THRESHOLDS.lateNightMinMessagesExclusive,
        laughCount: AWARD_THRESHOLDS.comedianMinLaughMessagesExclusive,
        name: index === 0 ? "A" : "B",
      })),
    };

    const awards = assignAwards(stats);
    expect(awards.map((award) => award.id)).toEqual([
      "perfectly-in-sync",
      "two-way-street",
      "the-metronome",
    ]);
    expect(awards).toEqual([
      {
        id: "perfectly-in-sync",
        label: "Perfectly In Sync",
        emoji: "🫶",
        who: "A & B",
        detail: "matching 30m median replies",
      },
      {
        id: "two-way-street",
        label: "Two-Way Street",
        emoji: "↔️",
        who: "A & B",
        detail: "50% / 50% message split",
      },
      {
        id: "the-metronome",
        label: "The Metronome",
        emoji: "⏱️",
        who: "A & B",
        detail: "7-day all-participant streak",
      },
    ]);
  });

  it("omits non-fitting real-like primaries instead of forcing all six", () => {
    const computed = computeStats([
      message("2024-06-01T09:00:00", "Guri"),
      message("2024-06-01T09:01:00", "Sanj"),
      message("2024-06-02T09:00:00", "Guri"),
      message("2024-06-02T09:01:00", "Sanj"),
    ]);
    const stats = {
      ...computed,
      longestStreakDays: 11,
      people: computed.people.map((candidate) =>
        candidate.name === "Guri"
          ? {
              ...candidate,
              messageCount: 53,
              messageShare: 0.53,
              avgWordsPerMessage: 5.1,
              medianReplyTimeMin: 1,
              conversationStarts: 174,
              lateNightCount: 259,
              laughCount: 143,
            }
          : {
              ...candidate,
              messageCount: 47,
              messageShare: 0.47,
              avgWordsPerMessage: 4.2,
              medianReplyTimeMin: 1,
              conversationStarts: 140,
              lateNightCount: 152,
              laughCount: 121,
            },
      ),
    };

    expect(assignAwards(stats).map((award) => award.id)).toEqual([
      "3am-overthinker",
      "comedian",
      "perfectly-in-sync",
      "the-metronome",
      "two-way-street",
    ]);
  });

  it("keeps addresses, phone numbers, links, and filler out of top words", () => {
    const stats = computeStats([
      message("2024-01-01T09:00:00", "A", "Sector 43 · Gurugram · Haryana 122003"),
      message("2024-01-01T09:01:00", "B", "https://example.com 98765 43210"),
      message("2024-01-01T09:02:00", "A", "haan"),
      message("2024-01-01T09:03:00", "B", "whale project whale project"),
    ]);

    expect(stats.people.flatMap((person) => person.topWords)).not.toEqual(
      expect.arrayContaining(["sector", "gurugram", "haryana", "haan", "example"]),
    );
    expect(stats.people.find((person) => person.name === "B")?.topWords).toContain("whale");
  });

  it("resolves qualifying tied primary metrics by participant appearance order", () => {
    const computed = computeStats([
      message("2024-07-01T10:00:00", "First", "hello"),
      message("2024-07-01T10:01:00", "Second", "hello"),
    ]);
    const stats = {
      ...computed,
      people: computed.people.map((candidate) => ({
        ...candidate,
        medianReplyTimeMin: 45,
      })),
    };

    expect(assignAwards(stats).find((award) => award.id === "certified-ghost")?.who).toBe(
      "First",
    );
  });
});
