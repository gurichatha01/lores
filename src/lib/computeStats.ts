import type {
  ChatStats,
  Message,
  ParsedWhatsAppExport,
  PersonStats,
  ReplyTimeBucket,
} from "./types";
import { sanitizeEvidenceText } from "./evidenceHygiene";
import { containsProfanityOrSlur } from "./sanitizeLlmInput";

export const REPLY_GAP_CAP_MIN = 6 * 60;
export const NO_REPLY_MEDIAN_MIN = 0;
export const MIN_CAPPED_REPLIES_FOR_MEDIAN = 3;

interface MutablePersonStats {
  name: string;
  messageCount: number;
  wordCount: number;
  replyTimesMin: number[];
  allReplyTimesMin: number[];
  conversationStarts: number;
  lastOfDayCount: number;
  lateNightCount: number;
  laughCount: number;
  profanityMessageCount: number;
  emojiCount: number;
  linkCount: number;
  maxConsecutiveMessages: number;
  silenceRevivalCount: number;
  weekendMessageCount: number;
  firstMessageDate: Date | null;
  lastMessageDate: Date | null;
  emojis: Map<string, number>;
  words: Map<string, number>;
}

const DAY_MS = 86_400_000;
const NOVEL_WORDS = 80_000;
const LONG_SILENCE_MIN = 24 * 60;
const TOP_EMOJI_LIMIT = 5;
const TOP_WORD_LIMIT = 10;
const WORD = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu;
const LAUGH_TOKEN =
  /(?:\b(?:ha(?:ha)+|he(?:he)+|hi(?:hi)+|lol+|lmao+|lmfao+|rofl+|hehe|bahaha+)\b|😂|🤣|💀)/giu;
const GOOD_MORNING = /\b(?:good\s*mornings?|gmorning|gud\s*morning|morning)\b/giu;
const I_LOVE_YOU = /\b(?:i\s+love\s+you|love\s+you|ily)\b/giu;
const RELATIONSHIP_TALK = /\bwhat\s+are\s+we\b/iu;
const LINK = /(?:https?:\/\/|www\.)[^\s]+/giu;
const REPLY_BUCKETS: ReplyTimeBucket[] = [
  { label: "<1m", count: 0 },
  { label: "1-5m", count: 0 },
  { label: "5-30m", count: 0 },
  { label: "30m-2h", count: 0 },
  { label: "2-4h", count: 0 },
  { label: "4-6h", count: 0 },
];

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
  "ok",
  "okay",
  "haan",
  "han",
  "hmm",
  "hmmm",
  "acha",
  "accha",
  "theek",
  "thik",
  "yep",
  "yup",
  "sure",
  "fine",
  "cool",
  "done",
  "noted",
]);

/**
 * Deterministically compute every ChatStats field.
 *
 * Definitions:
 * - A reply is a message whose sender differs from the immediately previous
 *   message's sender. The median normally excludes gaps over six hours as a
 *   new conversation; when a person has fewer than three such replies, all
 *   observed sender-change gaps are used so sparse, slow chats still report a
 *   meaningful median. A person with no observed replies keeps the zero/null
 *   sentinel and is the only case rendered as an em dash.
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
  const mediaCount = safeNonNegativeInteger(
    parsedExport ? input.mediaCount : explicitMediaCount,
  );
  const mediaBySender = parsedExport ? input.mediaBySender ?? {} : {};
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
  const chatEmojis = new Map<string, number>();
  const replyTimesMin: number[] = [];
  let totalWords = 0;
  let goodMorningCount = 0;
  let iLoveYouCount = 0;
  let firstLateNightDate: Date | null = null;
  let firstRelationshipTalkDate: Date | null = null;
  let previous: Message | undefined;
  let runSender = "";
  let runLength = 0;

  // Media-only messages are filtered by the parser, but their senders still
  // belong in the participant list and need a complete zero-default record.
  for (const sender of Object.keys(mediaBySender)) {
    getOrCreatePerson(people, sender);
  }

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
    person.firstMessageDate ??= new Date(timestamp.getTime());
    person.lastMessageDate = new Date(timestamp.getTime());
    if (timestamp.getDay() === 0 || timestamp.getDay() === 6) {
      person.weekendMessageCount += 1;
    }

    if (message.sender === runSender) {
      runLength += 1;
    } else {
      runSender = message.sender;
      runLength = 1;
    }
    person.maxConsecutiveMessages = Math.max(person.maxConsecutiveMessages, runLength);

    if (timestamp.getHours() < 4) {
      person.lateNightCount += 1;
      firstLateNightDate ??= new Date(timestamp.getTime());
    }

    person.laughCount += message.text.match(LAUGH_TOKEN)?.length ?? 0;
    if (containsProfanityOrSlur(message.text)) {
      person.profanityMessageCount += 1;
    }
    person.emojiCount += message.emojis.length;
    person.linkCount += message.text.match(LINK)?.length ?? 0;
    countEmojis(person.emojis, message.emojis);
    countEmojis(chatEmojis, message.emojis);
    countWords(person.words, message.text);
    goodMorningCount += message.text.match(GOOD_MORNING)?.length ?? 0;
    iLoveYouCount += message.text.match(I_LOVE_YOU)?.length ?? 0;
    if (!firstRelationshipTalkDate && RELATIONSHIP_TALK.test(message.text)) {
      firstRelationshipTalkDate = new Date(timestamp.getTime());
    }

    const gapMinutes = previous ? elapsedMinutes(previous, message) : Number.POSITIVE_INFINITY;
    if (previous && gapMinutes > LONG_SILENCE_MIN) {
      person.silenceRevivalCount += 1;
    }
    if (previous && previous.sender !== message.sender) {
      person.allReplyTimesMin.push(gapMinutes);
    }
    if (!previous || gapMinutes > REPLY_GAP_CAP_MIN) {
      person.conversationStarts += 1;
    } else if (previous.sender !== message.sender) {
      const replyTime = gapMinutes;
      person.replyTimesMin.push(replyTime);
      replyTimesMin.push(replyTime);
    }

    previous = message;
  }

  for (const message of lastMessageByDay.values()) {
    getOrCreatePerson(people, message.sender).lastOfDayCount += 1;
  }

  const participantCount = people.size;
  const first = messages[0].timestamp;
  const last = messages.at(-1)!.timestamp;
  const spanDays = localDayNumber(last) - localDayNumber(first) + 1;
  const personStats = Array.from(people.values(), (person): PersonStats => {
    const effectiveReplyTimes =
      person.replyTimesMin.length >= MIN_CAPPED_REPLIES_FOR_MEDIAN
        ? person.replyTimesMin
        : person.allReplyTimesMin;
    return {
      name: person.name,
      messageCount: person.messageCount,
      messageShare: safeDivide(person.messageCount, messages.length),
      wordCount: person.wordCount,
      avgWordsPerMessage: safeDivide(person.wordCount, person.messageCount),
      medianReplyTimeMin: median(effectiveReplyTimes),
      replyCount: effectiveReplyTimes.length,
      conversationStarts: person.conversationStarts,
      lastOfDayCount: person.lastOfDayCount,
      lateNightCount: person.lateNightCount,
      laughCount: person.laughCount,
      profanityMessageCount: person.profanityMessageCount,
      emojiCount: person.emojiCount,
      emojisPerMessage: round(safeDivide(person.emojiCount, person.messageCount), 3),
      linkCount: person.linkCount,
      mediaCount: safeNonNegativeInteger(mediaBySender[person.name] ?? 0),
      maxConsecutiveMessages: person.maxConsecutiveMessages,
      silenceRevivalCount: person.silenceRevivalCount,
      weekendMessageCount: person.weekendMessageCount,
      weekendShare: round(safeDivide(person.weekendMessageCount, person.messageCount), 3),
      activeSpanShare: round(
        safeDivide(
          person.firstMessageDate && person.lastMessageDate
            ? localDayNumber(person.lastMessageDate) - localDayNumber(person.firstMessageDate) + 1
            : 0,
          spanDays,
        ),
        3,
      ),
      topEmojis: topEntries(person.emojis, TOP_EMOJI_LIMIT).map(([emoji, count]) => ({
        emoji,
        count,
      })),
      topWords: topEntries(person.words, TOP_WORD_LIMIT).map(([word]) => word),
    };
  });
  const activeDays = [...dailyCounts.keys()].sort((left, right) => left - right);
  const busiest = findBusiestDay(dailyCounts);
  const longestSilenceRange = findLongestSilenceRange(activeDays);

  return {
    isGroup: participantCount > 2,
    people: personStats,
    totalMessages: messages.length,
    totalWords,
    novelsEquivalent: Math.round(totalWords / NOVEL_WORDS),
    mediaCount,
    firstMessageDate: new Date(first.getTime()),
    lastMessageDate: new Date(last.getTime()),
    spanDays,
    busiestDay: {
      date: dateFromLocalDayNumber(busiest.day),
      count: busiest.count,
    },
    longestStreakDays: findLongestStreak(dailyParticipants, participantCount),
    longestSilenceDays: longestSilenceRange?.days ?? 0,
    messagesByHour,
    messagesByWeekday,
    messagesByMonth: buildMonthlyCounts(messages),
    replyTimeDistribution: buildReplyTimeDistribution(replyTimesMin),
    topEmojis: topEntries(chatEmojis, TOP_EMOJI_LIMIT).map(([emoji, count]) => ({ emoji, count })),
    goodMorningCount,
    iLoveYouCount,
    firstLateNightDate,
    firstRelationshipTalkDate,
    longestSilenceRange,
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
    allReplyTimesMin: [],
    conversationStarts: 0,
    lastOfDayCount: 0,
    lateNightCount: 0,
    laughCount: 0,
    profanityMessageCount: 0,
    emojiCount: 0,
    linkCount: 0,
    maxConsecutiveMessages: 0,
    silenceRevivalCount: 0,
    weekendMessageCount: 0,
    firstMessageDate: null,
    lastMessageDate: null,
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
  const textWithoutLinks = message.text.replace(LINK, " ");
  return textWithoutLinks.match(WORD)?.length ?? 0;
}

function safeDivide(numerator: number, denominator: number): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) {
    return 0;
  }
  const value = numerator / denominator;
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

function safeNonNegativeInteger(value: number): number {
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
}

function countEmojis(counts: Map<string, number>, emojis: readonly string[]): void {
  for (const emoji of emojis) {
    counts.set(emoji, (counts.get(emoji) ?? 0) + 1);
  }
}

function countWords(counts: Map<string, number>, text: string): void {
  const cleaned = sanitizeEvidenceText(text);
  if (!cleaned) return;
  for (const match of cleaned.match(WORD) ?? []) {
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
  const validValues = values.filter((value) => Number.isFinite(value) && value >= 0);
  if (validValues.length === 0) {
    return NO_REPLY_MEDIAN_MIN;
  }

  const sorted = [...validValues].sort((left, right) => left - right);
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

function findLongestSilenceRange(activeDays: readonly number[]): ChatStats["longestSilenceRange"] {
  let winner: ChatStats["longestSilenceRange"] = null;
  for (let index = 1; index < activeDays.length; index += 1) {
    const days = activeDays[index] - activeDays[index - 1] - 1;
    if (days > 0 && (!winner || days > winner.days)) {
      winner = {
        startDate: dateFromLocalDayNumber(activeDays[index - 1] + 1),
        endDate: dateFromLocalDayNumber(activeDays[index] - 1),
        days,
      };
    }
  }
  return winner;
}

function buildMonthlyCounts(messages: readonly Message[]): ChatStats["messagesByMonth"] {
  const counts = new Map<string, number>();
  for (const message of messages) {
    const key = monthKey(message.timestamp.getFullYear(), message.timestamp.getMonth());
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const first = messages[0].timestamp;
  const last = messages.at(-1)!.timestamp;
  const months: ChatStats["messagesByMonth"] = [];
  let year = first.getFullYear();
  let month = first.getMonth();

  while (year < last.getFullYear() || (year === last.getFullYear() && month <= last.getMonth())) {
    const key = monthKey(year, month);
    months.push({ month: key, count: counts.get(key) ?? 0 });
    month += 1;
    if (month === 12) {
      month = 0;
      year += 1;
    }
  }
  return months;
}

function buildReplyTimeDistribution(replyTimes: readonly number[]): ReplyTimeBucket[] {
  const buckets = REPLY_BUCKETS.map((bucket) => ({ ...bucket }));
  for (const minutes of replyTimes) {
    const index =
      minutes < 1 ? 0 : minutes <= 5 ? 1 : minutes <= 30 ? 2 : minutes <= 120 ? 3 : minutes <= 240 ? 4 : 5;
    buckets[index].count += 1;
  }
  return buckets;
}

function monthKey(year: number, zeroBasedMonth: number): string {
  return `${year}-${String(zeroBasedMonth + 1).padStart(2, "0")}`;
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
