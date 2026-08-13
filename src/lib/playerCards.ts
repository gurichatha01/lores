import { formatCount, formatReplyTime } from "./reportPresentation";
import type { Award, PersonStats, ReportMode, ReportSessionData } from "./types";

export interface PlayerCardStat {
  id: string;
  label: string;
  value: string;
  score: number;
}

export interface PlayerCardSecondary {
  label: string;
  value: string;
}

export interface PlayerCardModel {
  personName: string;
  role: string;
  summary: string;
  watermarkEmoji: string | null;
  signatureWords: string[];
  stats: PlayerCardStat[];
  secondary: [PlayerCardSecondary, PlayerCardSecondary];
  verdict: string;
}

const ROLE_BY_AWARD_ID: Record<string, string> = {
  "certified-ghost": "The Ghost",
  "main-character": "Main Character",
  "3am-overthinker": "The Overthinker",
  "one-word-warrior": "The One-Word Warrior",
  comedian: "The Comedian",
  "the-sailor": "The Sailor",
  "the-initiator": "The Initiator",
  "the-lurker": "The Lurker",
  "the-novelist": "The Novelist",
  "reply-guy": "The Reply Guy",
  "emoji-addict": "The Emoji Addict",
  "the-broadcaster": "The Broadcaster",
  "the-double-texter": "The Double-Texter",
  "the-reviver": "The Reviver",
  "weekend-warrior": "The Weekend Warrior",
};

export function buildPlayerCards(report: ReportSessionData): PlayerCardModel[] {
  const lines = new Map(report.content.awardLines.map(({ awardId, line }) => [awardId, line.trim()]));
  return report.stats.people.map((person) =>
    buildPlayerCard(person, report.mode, report.awards, lines),
  );
}

export function buildPlayerCard(
  person: PersonStats,
  mode: ReportMode,
  awards: readonly Award[],
  awardLines: ReadonlyMap<string, string>,
): PlayerCardModel {
  const primaryAward = awards.find((award) => award.who === person.name);
  const candidates = buildStatCandidates(person, mode);
  const stats = candidates.slice(0, 3);
  const remaining = candidates.find((candidate) => !stats.some((stat) => stat.id === candidate.id));
  const topEmoji = person.topEmojis?.[0];
  const signatureWords = (person.topWords ?? []).filter(Boolean).slice(0, 10);
  const awardLine = primaryAward ? awardLines.get(primaryAward.id) : undefined;

  return {
    personName: person.name || "Unknown participant",
    role: primaryAward ? roleFromAward(primaryAward) : fallbackRole(mode),
    summary: `${formatCount(safeCount(person.messageCount))} messages · ${Math.round(safeRatio(person.messageShare) * 100)}% of chat`,
    watermarkEmoji: topEmoji?.emoji || null,
    signatureWords: signatureWords.length > 0 ? signatureWords : ["no repeated words yet"],
    stats,
    secondary: [
      {
        label: "most-used emoji",
        value: topEmoji?.emoji ? `${topEmoji.emoji} ×${formatCount(safeCount(topEmoji.count))}` : "none yet",
      },
      remaining
        ? { label: remaining.label, value: remaining.value }
        : { label: "total words", value: formatCount(safeCount(person.wordCount)) },
    ],
    verdict: awardLine || deterministicVerdict(person),
  };
}

function buildStatCandidates(person: PersonStats, mode: ReportMode): PlayerCardStat[] {
  const messages = Math.max(1, safeCount(person.messageCount));
  const candidates: PlayerCardStat[] = [];
  const add = (id: string, label: string, value: string, score: number, show = true) => {
    if (show) candidates.push({ id, label, value, score });
  };

  add(
    "late-night",
    "late-night msgs",
    formatCount(safeCount(person.lateNightCount)),
    signal(person.lateNightCount / messages, person.lateNightCount, 0.08, 20),
    safeCount(person.lateNightCount) > 0,
  );
  add(
    "laughs",
    "laugh msgs",
    formatCount(safeCount(person.laughCount)),
    signal(person.laughCount / messages, person.laughCount, 0.08, 25),
    safeCount(person.laughCount) > 0,
  );
  add(
    "conversation-starts",
    "chat starts",
    formatCount(safeCount(person.conversationStarts)),
    signal(person.conversationStarts / messages, person.conversationStarts, 0.12, 25),
    safeCount(person.conversationStarts) > 0,
  );
  add(
    "reply-time",
    "median reply",
    formatReplyTime(safeNumber(person.medianReplyTimeMin), safeCount(person.replyCount)),
    0.78 + Math.min(0.22, safeCount(person.replyCount) / 100),
    safeCount(person.replyCount) > 0,
  );
  add(
    "avg-words",
    "avg words / msg",
    formatDecimal(safeNumber(person.avgWordsPerMessage)),
    0.5 + Math.min(0.28, Math.abs(safeNumber(person.avgWordsPerMessage) - 5) / 20),
    safeCount(person.messageCount) > 0,
  );
  add(
    "last-of-day",
    "last-of-day",
    formatCount(safeCount(person.lastOfDayCount)),
    signal(person.lastOfDayCount / messages, person.lastOfDayCount, 0.08, 20),
    safeCount(person.lastOfDayCount) > 0,
  );
  add(
    "double-texts",
    "longest run",
    formatCount(safeCount(person.maxConsecutiveMessages)),
    0.56 + Math.min(0.4, safeCount(person.maxConsecutiveMessages) / 20),
    safeCount(person.maxConsecutiveMessages) > 1,
  );
  add(
    "revivals",
    "chat revivals",
    formatCount(safeCount(person.silenceRevivalCount)),
    0.62 + Math.min(0.35, safeCount(person.silenceRevivalCount) / 20),
    safeCount(person.silenceRevivalCount) > 0,
  );
  add(
    "weekend",
    "weekend share",
    `${Math.round(safeRatio(person.weekendShare) * 100)}%`,
    0.5 + Math.min(0.45, Math.abs(safeRatio(person.weekendShare) - 2 / 7)),
    safeCount(person.weekendMessageCount) > 0,
  );
  add(
    "emoji-rate",
    "emoji / msg",
    formatDecimal(safeNumber(person.emojisPerMessage)),
    0.5 + Math.min(0.45, safeNumber(person.emojisPerMessage) / 2),
    safeCount(person.emojiCount) > 0,
  );
  add(
    "broadcasts",
    "links + media",
    formatCount(safeCount(person.linkCount) + safeCount(person.mediaCount)),
    0.55 + Math.min(0.4, (safeCount(person.linkCount) + safeCount(person.mediaCount)) / 30),
    safeCount(person.linkCount) + safeCount(person.mediaCount) > 0,
  );
  add(
    "profanity",
    "curse msgs",
    formatCount(safeCount(person.profanityMessageCount)),
    0.6 + Math.min(0.38, safeCount(person.profanityMessageCount) / 40),
    (mode === "roast" || mode === "group") && safeCount(person.profanityMessageCount) > 0,
  );

  if (candidates.length < 3) {
    add("messages", "messages", formatCount(safeCount(person.messageCount)), 0.2);
    add("share", "share of chat", `${Math.round(safeRatio(person.messageShare) * 100)}%`, 0.15);
    add("words", "total words", formatCount(safeCount(person.wordCount)), 0.1);
  }

  return candidates
    .filter((candidate, index, all) => all.findIndex(({ id }) => id === candidate.id) === index)
    .sort((left, right) => right.score - left.score);
}

function roleFromAward(award: Award): string {
  const mapped = ROLE_BY_AWARD_ID[award.id];
  if (mapped) return mapped;
  const label = award.label.replace(/[\p{Extended_Pictographic}\uFE0F]/gu, "").trim();
  if (/^the\s/iu.test(label) || label === "Main Character") return label;
  return `The ${label || "Regular"}`;
}

function fallbackRole(mode: ReportMode): string {
  if (mode === "roast") return "The Usual Suspect";
  if (mode === "work") return "The Regular";
  return "The Constant";
}

function deterministicVerdict(person: PersonStats): string {
  if (safeCount(person.replyCount) > 0) {
    return `Kept the thread moving with a ${formatReplyTime(safeNumber(person.medianReplyTimeMin), person.replyCount)} median reply across ${formatCount(safeCount(person.replyCount))} replies.`;
  }
  if (safeCount(person.conversationStarts) > 0) {
    return `Opened ${formatCount(safeCount(person.conversationStarts))} conversations and kept the thread moving.`;
  }
  return `Logged ${formatCount(safeCount(person.messageCount))} messages across ${formatCount(safeCount(person.wordCount))} words.`;
}

function signal(ratio: number, count: number, ratioScale: number, countScale: number): number {
  return 0.45 + Math.min(0.3, safeNumber(ratio) / ratioScale * 0.3) + Math.min(0.25, safeCount(count) / countScale * 0.25);
}

function safeNumber(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function safeCount(value: number): number {
  return Math.round(safeNumber(value));
}

function safeRatio(value: number): number {
  return Math.min(1, safeNumber(value));
}

function formatDecimal(value: number): string {
  return Number(safeNumber(value).toFixed(1)).toString();
}
