import type {
  Award,
  GenerateReportInput,
  PersonStats,
  ReportContent,
  ReportSampleMessage,
  ReportStats,
} from "./types";
import { isReportMode } from "./modePresets";

const INPUT_KEYS = ["mode", "subtype", "userContext", "stats", "awards", "sample"] as const;
const STATS_KEYS = [
  "isGroup",
  "people",
  "totalMessages",
  "totalWords",
  "novelsEquivalent",
  "mediaCount",
  "firstMessageDate",
  "lastMessageDate",
  "spanDays",
  "busiestDay",
  "longestStreakDays",
  "longestSilenceDays",
  "messagesByHour",
  "messagesByWeekday",
] as const;
const PERSON_KEYS = [
  "name",
  "messageCount",
  "messageShare",
  "wordCount",
  "avgWordsPerMessage",
  "medianReplyTimeMin",
  "conversationStarts",
  "lastOfDayCount",
  "lateNightCount",
  "laughCount",
  "topEmojis",
  "topWords",
] as const;
const SAMPLE_KEYS = ["timestamp", "sender", "text", "wordCount", "hasEmoji", "emojis"] as const;
const AWARD_KEYS = ["id", "label", "emoji", "who"] as const;
const LOCAL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/u;
const LOCAL_DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/u;

export class ReportValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReportValidationError";
  }
}

export function parseGenerateReportInput(value: unknown): GenerateReportInput {
  const input = asRecord(value, "request body");
  assertExactKeys(input, INPUT_KEYS, "request body");
  if (!isReportMode(input.mode)) {
    throw new ReportValidationError("mode is not supported.");
  }

  const stats = parseReportStats(input.stats);
  const awards = parseAwards(input.awards);
  const sample = asArray(input.sample, "sample").map(parseSampleMessage);
  const people = new Set(stats.people.map((person) => person.name));

  if (sample.length === 0 || sample.length > Math.min(stats.totalMessages, stats.people.length * 30)) {
    throw new ReportValidationError("sample must contain at most 30 curated messages per person.");
  }
  if (sample.some((message) => !people.has(message.sender))) {
    throw new ReportValidationError("Every sample sender must exist in stats.people.");
  }
  if (awards.some((award) => !people.has(award.who))) {
    throw new ReportValidationError("Every award winner must exist in stats.people.");
  }

  return {
    mode: input.mode,
    subtype: asString(input.subtype, "subtype", 100, true),
    userContext: asString(input.userContext, "userContext", 2_000, true),
    stats,
    awards,
    sample,
  };
}

export function parseReportContent(value: unknown): ReportContent {
  const content = asRecord(value, "report");
  assertExactKeys(
    content,
    ["title", "heroLine", "highlights", "awardLines", "narrative", "chapters"],
    "report",
    ["chapters"],
  );

  const highlights = asArray(content.highlights, "report.highlights").map((value, index) => {
    const highlight = asRecord(value, `report.highlights[${index}]`);
    assertExactKeys(highlight, ["label", "body", "bubble"], `report.highlights[${index}]`, ["bubble"]);
    return {
      label: asString(highlight.label, `report.highlights[${index}].label`, 160),
      body: asString(highlight.body, `report.highlights[${index}].body`, 2_000),
      ...(highlight.bubble === undefined
        ? {}
        : { bubble: asString(highlight.bubble, `report.highlights[${index}].bubble`, 1_000) }),
    };
  });
  const awardLines = asArray(content.awardLines, "report.awardLines").map((value, index) => {
    const line = asRecord(value, `report.awardLines[${index}]`);
    assertExactKeys(line, ["awardId", "line"], `report.awardLines[${index}]`);
    return {
      awardId: asString(line.awardId, `report.awardLines[${index}].awardId`, 100),
      line: asString(line.line, `report.awardLines[${index}].line`, 1_000),
    };
  });
  const chapters =
    content.chapters === undefined
      ? undefined
      : asArray(content.chapters, "report.chapters").map((value, index) => {
          const chapter = asRecord(value, `report.chapters[${index}]`);
          assertExactKeys(chapter, ["title", "body"], `report.chapters[${index}]`);
          return {
            title: asString(chapter.title, `report.chapters[${index}].title`, 160),
            body: asString(chapter.body, `report.chapters[${index}].body`, 4_000),
          };
        });

  return {
    title: asString(content.title, "report.title", 200),
    heroLine: asString(content.heroLine, "report.heroLine", 500),
    highlights,
    awardLines,
    narrative: asString(content.narrative, "report.narrative", 8_000),
    ...(chapters === undefined ? {} : { chapters }),
  };
}

export function parseReportStats(value: unknown): ReportStats {
  const stats = asRecord(value, "stats");
  assertExactKeys(stats, STATS_KEYS, "stats");
  const people = asArray(stats.people, "stats.people").map(parsePerson);
  if (people.length === 0) {
    throw new ReportValidationError("stats.people cannot be empty.");
  }

  const messagesByHour = numberArray(stats.messagesByHour, "stats.messagesByHour", 24);
  const messagesByWeekday = numberArray(stats.messagesByWeekday, "stats.messagesByWeekday", 7);
  const busiestDay = asRecord(stats.busiestDay, "stats.busiestDay");
  assertExactKeys(busiestDay, ["date", "count"], "stats.busiestDay");

  return {
    isGroup: asBoolean(stats.isGroup, "stats.isGroup"),
    people,
    totalMessages: asNonNegativeInteger(stats.totalMessages, "stats.totalMessages"),
    totalWords: asNonNegativeInteger(stats.totalWords, "stats.totalWords"),
    novelsEquivalent: asNonNegativeInteger(stats.novelsEquivalent, "stats.novelsEquivalent"),
    mediaCount: asNonNegativeInteger(stats.mediaCount, "stats.mediaCount"),
    firstMessageDate: asLocalDateTime(stats.firstMessageDate, "stats.firstMessageDate"),
    lastMessageDate: asLocalDateTime(stats.lastMessageDate, "stats.lastMessageDate"),
    spanDays: asNonNegativeInteger(stats.spanDays, "stats.spanDays"),
    busiestDay: {
      date: asLocalDate(busiestDay.date, "stats.busiestDay.date"),
      count: asNonNegativeInteger(busiestDay.count, "stats.busiestDay.count"),
    },
    longestStreakDays: asNonNegativeInteger(stats.longestStreakDays, "stats.longestStreakDays"),
    longestSilenceDays: asNonNegativeInteger(stats.longestSilenceDays, "stats.longestSilenceDays"),
    messagesByHour,
    messagesByWeekday,
  };
}

export function parseAwards(value: unknown): Award[] {
  return asArray(value, "awards").map(parseAward);
}

function parsePerson(value: unknown, index: number): PersonStats {
  const person = asRecord(value, `stats.people[${index}]`);
  assertExactKeys(person, PERSON_KEYS, `stats.people[${index}]`);
  const topEmojis = asArray(person.topEmojis, `stats.people[${index}].topEmojis`).map(
    (value, emojiIndex) => {
      const entry = asRecord(value, `stats.people[${index}].topEmojis[${emojiIndex}]`);
      assertExactKeys(entry, ["emoji", "count"], `stats.people[${index}].topEmojis[${emojiIndex}]`);
      return {
        emoji: asString(entry.emoji, `stats.people[${index}].topEmojis[${emojiIndex}].emoji`, 32),
        count: asNonNegativeInteger(
          entry.count,
          `stats.people[${index}].topEmojis[${emojiIndex}].count`,
        ),
      };
    },
  );

  return {
    name: asString(person.name, `stats.people[${index}].name`, 100),
    messageCount: asNonNegativeInteger(person.messageCount, `stats.people[${index}].messageCount`),
    messageShare: asFiniteNumber(person.messageShare, `stats.people[${index}].messageShare`, 0, 1),
    wordCount: asNonNegativeInteger(person.wordCount, `stats.people[${index}].wordCount`),
    avgWordsPerMessage: asFiniteNumber(
      person.avgWordsPerMessage,
      `stats.people[${index}].avgWordsPerMessage`,
      0,
    ),
    medianReplyTimeMin: asFiniteNumber(
      person.medianReplyTimeMin,
      `stats.people[${index}].medianReplyTimeMin`,
      0,
    ),
    conversationStarts: asNonNegativeInteger(
      person.conversationStarts,
      `stats.people[${index}].conversationStarts`,
    ),
    lastOfDayCount: asNonNegativeInteger(person.lastOfDayCount, `stats.people[${index}].lastOfDayCount`),
    lateNightCount: asNonNegativeInteger(person.lateNightCount, `stats.people[${index}].lateNightCount`),
    laughCount: asNonNegativeInteger(person.laughCount, `stats.people[${index}].laughCount`),
    topEmojis,
    topWords: asArray(person.topWords, `stats.people[${index}].topWords`).map((word, wordIndex) =>
      asString(word, `stats.people[${index}].topWords[${wordIndex}]`, 100),
    ),
  };
}

function parseAward(value: unknown, index: number): Award {
  const award = asRecord(value, `awards[${index}]`);
  assertExactKeys(award, AWARD_KEYS, `awards[${index}]`);
  return {
    id: asString(award.id, `awards[${index}].id`, 100),
    label: asString(award.label, `awards[${index}].label`, 160),
    emoji: asString(award.emoji, `awards[${index}].emoji`, 32),
    who: asString(award.who, `awards[${index}].who`, 100),
  };
}

function parseSampleMessage(value: unknown, index: number): ReportSampleMessage {
  const message = asRecord(value, `sample[${index}]`);
  assertExactKeys(message, SAMPLE_KEYS, `sample[${index}]`);
  return {
    timestamp: asLocalDateTime(message.timestamp, `sample[${index}].timestamp`),
    sender: asString(message.sender, `sample[${index}].sender`, 100),
    text: asString(message.text, `sample[${index}].text`, 10_000),
    wordCount: asNonNegativeInteger(message.wordCount, `sample[${index}].wordCount`),
    hasEmoji: asBoolean(message.hasEmoji, `sample[${index}].hasEmoji`),
    emojis: asArray(message.emojis, `sample[${index}].emojis`).map((emoji, emojiIndex) =>
      asString(emoji, `sample[${index}].emojis[${emojiIndex}]`, 32),
    ),
  };
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ReportValidationError(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function asArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new ReportValidationError(`${label} must be an array.`);
  }
  return value;
}

function asString(value: unknown, label: string, maxLength: number, allowEmpty = false): string {
  if (
    typeof value !== "string" ||
    value.length > maxLength ||
    (!allowEmpty && value.trim().length === 0)
  ) {
    throw new ReportValidationError(`${label} must be a valid string.`);
  }
  return value;
}

function asBoolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") {
    throw new ReportValidationError(`${label} must be a boolean.`);
  }
  return value;
}

function asNonNegativeInteger(value: unknown, label: string): number {
  const number = asFiniteNumber(value, label, 0);
  if (!Number.isInteger(number)) {
    throw new ReportValidationError(`${label} must be an integer.`);
  }
  return number;
}

function asFiniteNumber(value: unknown, label: string, minimum: number, maximum = Infinity): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum || value > maximum) {
    throw new ReportValidationError(`${label} must be a valid number.`);
  }
  return value;
}

function numberArray(value: unknown, label: string, length: number): number[] {
  const array = asArray(value, label);
  if (array.length !== length) {
    throw new ReportValidationError(`${label} must contain ${length} entries.`);
  }
  return array.map((entry, index) => asNonNegativeInteger(entry, `${label}[${index}]`));
}

function assertExactKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
  label: string,
  optional: readonly string[] = [],
): void {
  const allowed = new Set(keys);
  const optionalSet = new Set(optional);
  if (Object.keys(value).some((key) => !allowed.has(key))) {
    throw new ReportValidationError(`${label} contains an unsupported field.`);
  }
  if (keys.some((key) => !optionalSet.has(key) && !(key in value))) {
    throw new ReportValidationError(`${label} is missing a required field.`);
  }
}

function asLocalDate(value: unknown, label: string): string {
  const date = asString(value, label, 10);
  const match = LOCAL_DATE.exec(date);
  if (!match || !isCalendarDate(Number(match[1]), Number(match[2]), Number(match[3]))) {
    throw new ReportValidationError(`${label} must be a local YYYY-MM-DD date.`);
  }
  return date;
}

function asLocalDateTime(value: unknown, label: string): string {
  const dateTime = asString(value, label, 40);
  const match = LOCAL_DATE_TIME.exec(dateTime);
  if (
    !match ||
    !isCalendarDate(Number(match[1]), Number(match[2]), Number(match[3])) ||
    Number(match[4]) > 23 ||
    Number(match[5]) > 59 ||
    Number(match[6]) > 59
  ) {
    throw new ReportValidationError(`${label} must be a local wall-clock timestamp without a UTC suffix.`);
  }
  return dateTime;
}

function isCalendarDate(year: number, month: number, day: number): boolean {
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1];
}
