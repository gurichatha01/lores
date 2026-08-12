import type { ChatStats, Message, ParsedWhatsAppExport, PersonStats } from "./types";

export const REPLY_GAP_CAP_MIN = 6 * 60;

interface MutablePersonStats {
  name: string;
  messageCount: number;
  wordCount: number;
  replyTimesMin: number[];
  conversationStarts: number;
  lastOfDayCount: number;
  lateNightCount: number;
  laughCount: number;
  emojis: Map<string, number>;
  words: Map<string, number>;
}

const DAY_MS = 86_400_000;
const NOVEL_WORDS = 80_000;
const TOP_EMOJI_LIMIT = 5;
const TOP_WORD_LIMIT = 10;
const WORD = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu;
const URL = /(?:https?:\/\/|www\.)\S+/giu;
const LAUGH_TOKEN =
  /(?:\b(?:ha(?:ha)+|he(?:he)+|hi(?:hi)+|lol+|lmao+|lmfao+|rofl+|hehe|bahaha+)\b|😂|🤣|💀)/giu;

const STOP_WORDS = new Set([
  "a",
  "about",
  "after",
  "again",
  "all",
  "am",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "been",
  "before",
  "being",
  "but",
  "by",
  "can",
  "did",
  "do",
  "does",
  "doing",
  "don",
  "for",
  "from",
  "had",
  "has",
  "have",
  "he",
  "her",
  "here",
  "hers",
  "him",
  "his",
  "how",
  "hai",
  "hain",
  "ho",
  "hu",
  "hun",
  "i",
  "if",
  "in",
  "is",
  "it",
  "its",
  "just",
  "me",
  "mai",
  "main",
  "mein",
  "my",
  "no",
  "not",
  "of",
  "on",
  "or",
  "aur",
  "our",
  "ours",
  "she",
  "so",
  "some",
  "se",
  "than",
  "tha",
  "thi",
  "that",
  "the",
  "their",
  "them",
  "then",
  "there",
  "they",
  "this",
  "to",
  "toh",
  "too",
  "up",
  "us",
  "was",
  "we",
  "were",
  "what",
  "wo",
  "woh",
  "when",
  "where",
  "which",
  "who",
  "why",
  "will",
  "with",
  "would",
  "ye",
  "yeh",
  "you",
  "your",
  "yours",
  "bhi",
  "ka",
  "ke",
  "ki",
  "ko",
  "kya",
  "par",
]);

/**
 * Deterministically compute every ChatStats field.
 *
 * Definitions:
 * - A reply is a message whose sender differs from the immediately previous
 *   message's sender; gaps over six hours are excluded as a new conversation.
 * - A conversation start is the first message, or the first message after a
 *   gap strictly greater than six hours.
 * - A streak day counts only when every participant sent at least one message.
 * - Longest silence is the count of complete calendar days between active days.
 * - `lastOfDayCount` goes to the final chronologically sorted message each day.
 */
export function computeStats(
  input: readonly Message[] | ParsedWhatsAppExport,
  explicitMediaCount = 0,
): ChatStats {
  const parsedExport = isParsedExport(input);
  const sourceMessages = parsedExport ? input.messages : input;
  const mediaCount = parsedExport ? input.mediaCount : explicitMediaCount;
  const messages = [...sourceMessages].sort(
    (left, right) => left.timestamp.getTime() - right.timestamp.getTime(),
  );

  if (messages.length === 0) {
    throw new Error("Cannot compute chat stats without messages.");
  }

  for (const message of messages) {
    if (Number.isNaN(message.timestamp.getTime())) {
      throw new Error("Cannot compute chat stats with an invalid message timestamp.");
    }
  }

  const people = new Map<string, MutablePersonStats>();
  const dailyCounts = new Map<number, number>();
  const dailyParticipants = new Map<number, Set<string>>();
  const lastMessageByDay = new Map<number, Message>();
  const messagesByHour = Array<number>(24).fill(0);
  const messagesByWeekday = Array<number>(7).fill(0);
  let totalWords = 0;
  let previous: Message | undefined;

  for (const message of messages) {
    const person = getOrCreatePerson(people, message.sender);
    const wordCount = safeWordCount(message);
    const timestamp = message.timestamp;
    const day = localDayNumber(timestamp);

    person.messageCount += 1;
    person.wordCount += wordCount;
    totalWords += wordCount;
    messagesByHour[timestamp.getHours()] += 1;
    messagesByWeekday[mondayFirstWeekday(timestamp)] += 1;
    dailyCounts.set(day, (dailyCounts.get(day) ?? 0) + 1);
    getOrCreateSet(dailyParticipants, day).add(message.sender);
    lastMessageByDay.set(day, message);

    if (timestamp.getHours() < 4) {
      person.lateNightCount += 1;
    }

    person.laughCount += message.text.match(LAUGH_TOKEN)?.length ?? 0;
    countEmojis(person.emojis, message.emojis);
    countWords(person.words, message.text);

    if (!previous || elapsedMinutes(previous, message) > REPLY_GAP_CAP_MIN) {
      person.conversationStarts += 1;
    } else if (previous.sender !== message.sender) {
      person.replyTimesMin.push(elapsedMinutes(previous, message));
    }

    previous = message;
  }

  for (const message of lastMessageByDay.values()) {
    getOrCreatePerson(people, message.sender).lastOfDayCount += 1;
  }

  const participantCount = people.size;
  const personStats = Array.from(people.values(), (person): PersonStats => ({
    name: person.name,
    messageCount: person.messageCount,
    messageShare: person.messageCount / messages.length,
    wordCount: person.wordCount,
    avgWordsPerMessage: person.wordCount / person.messageCount,
    medianReplyTimeMin: median(person.replyTimesMin),
    conversationStarts: person.conversationStarts,
    lastOfDayCount: person.lastOfDayCount,
    lateNightCount: person.lateNightCount,
    laughCount: person.laughCount,
    topEmojis: topEntries(person.emojis, TOP_EMOJI_LIMIT).map(([emoji, count]) => ({ emoji, count })),
    topWords: topEntries(person.words, TOP_WORD_LIMIT).map(([word]) => word),
  }));
  const activeDays = [...dailyCounts.keys()].sort((left, right) => left - right);
  const first = messages[0].timestamp;
  const last = messages.at(-1)!.timestamp;
  const busiest = findBusiestDay(dailyCounts);

  return {
    isGroup: participantCount > 2,
    people: personStats,
    totalMessages: messages.length,
    totalWords,
    novelsEquivalent: Math.round(totalWords / NOVEL_WORDS),
    mediaCount,
    firstMessageDate: new Date(first.getTime()),
    lastMessageDate: new Date(last.getTime()),
    spanDays: localDayNumber(last) - localDayNumber(first) + 1,
    busiestDay: {
      date: dateFromLocalDayNumber(busiest.day),
      count: busiest.count,
    },
    longestStreakDays: findLongestStreak(dailyParticipants, participantCount),
    longestSilenceDays: findLongestSilence(activeDays),
    messagesByHour,
    messagesByWeekday,
  };
}

function isParsedExport(
  input: readonly Message[] | ParsedWhatsAppExport,
): input is ParsedWhatsAppExport {
  return !Array.isArray(input);
}

function getOrCreatePerson(
  people: Map<string, MutablePersonStats>,
  name: string,
): MutablePersonStats {
  const existing = people.get(name);
  if (existing) {
    return existing;
  }

  const person: MutablePersonStats = {
    name,
    messageCount: 0,
    wordCount: 0,
    replyTimesMin: [],
    conversationStarts: 0,
    lastOfDayCount: 0,
    lateNightCount: 0,
    laughCount: 0,
    emojis: new Map(),
    words: new Map(),
  };
  people.set(name, person);
  return person;
}

function getOrCreateSet(map: Map<number, Set<string>>, key: number): Set<string> {
  const existing = map.get(key);
  if (existing) {
    return existing;
  }
  const created = new Set<string>();
  map.set(key, created);
  return created;
}

function safeWordCount(message: Message): number {
  return Number.isFinite(message.wordCount) && message.wordCount >= 0
    ? message.wordCount
    : message.text.match(WORD)?.length ?? 0;
}

function countEmojis(counts: Map<string, number>, emojis: readonly string[]): void {
  for (const emoji of emojis) {
    counts.set(emoji, (counts.get(emoji) ?? 0) + 1);
  }
}

function countWords(counts: Map<string, number>, text: string): void {
  for (const match of text.replace(URL, " ").match(WORD) ?? []) {
    const word = match.toLowerCase();
    if (word.length < 2 || STOP_WORDS.has(word) || /^\d+$/u.test(word)) {
      continue;
    }
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }
}

function elapsedMinutes(previous: Message, current: Message): number {
  return (current.timestamp.getTime() - previous.timestamp.getTime()) / 60_000;
}

function median(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const midpoint = Math.floor(sorted.length / 2);
  const value =
    sorted.length % 2 === 0
      ? (sorted[midpoint - 1] + sorted[midpoint]) / 2
      : sorted[midpoint];
  return round(value, 2);
}

function topEntries(counts: ReadonlyMap<string, number>, limit: number): Array<[string, number]> {
  return [...counts.entries()]
    // Modern JavaScript's stable sort preserves first-seen order for tied counts.
    .sort(([, leftCount], [, rightCount]) => rightCount - leftCount)
    .slice(0, limit);
}

function findBusiestDay(counts: ReadonlyMap<number, number>): { day: number; count: number } {
  let winnerDay = Number.POSITIVE_INFINITY;
  let winnerCount = 0;

  for (const [day, count] of counts) {
    if (count > winnerCount || (count === winnerCount && day < winnerDay)) {
      winnerDay = day;
      winnerCount = count;
    }
  }

  return { day: winnerDay, count: winnerCount };
}

function findLongestStreak(
  participantsByDay: ReadonlyMap<number, ReadonlySet<string>>,
  participantCount: number,
): number {
  const sharedDays = [...participantsByDay.entries()]
    .filter(([, participants]) => participants.size === participantCount)
    .map(([day]) => day)
    .sort((left, right) => left - right);

  let longest = 0;
  let current = 0;
  let previous: number | undefined;

  for (const day of sharedDays) {
    current = previous !== undefined && day === previous + 1 ? current + 1 : 1;
    longest = Math.max(longest, current);
    previous = day;
  }

  return longest;
}

function findLongestSilence(activeDays: readonly number[]): number {
  let longest = 0;
  for (let index = 1; index < activeDays.length; index += 1) {
    longest = Math.max(longest, activeDays[index] - activeDays[index - 1] - 1);
  }
  return longest;
}

function localDayNumber(date: Date): number {
  // Encode local calendar fields as a stable day ordinal. Date.UTC is used only
  // for arithmetic here; the instant's UTC date is never read for bucketing.
  return Math.round(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS);
}

function dateFromLocalDayNumber(day: number): Date {
  const ordinalDate = new Date(day * DAY_MS);
  return new Date(
    ordinalDate.getUTCFullYear(),
    ordinalDate.getUTCMonth(),
    ordinalDate.getUTCDate(),
  );
}

function mondayFirstWeekday(date: Date): number {
  return (date.getDay() + 6) % 7;
}

function round(value: number, decimalPlaces: number): number {
  const factor = 10 ** decimalPlaces;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}
