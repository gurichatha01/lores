import { getModePreset, type StatMetric } from "./modePresets";
import type { PersonStats, ReportMode, ReportStats } from "./types";

export interface ModeStatCard {
  label: string;
  value: string;
  detail: string;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const integer = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

const FALLBACK_METRICS: Record<ReportMode, readonly StatMetric[]> = {
  sweetheart: ["i-love-yous", "good-mornings", "message-share", "message-count", "word-count", "chat-span", "top-emoji", "busiest-day"],
  "ride-or-die": ["message-count", "word-count", "chat-span", "top-emoji", "busiest-day", "conversation-starts"],
  group: ["message-count", "word-count", "chat-span", "top-emoji", "busiest-day", "busiest-hour"],
  family: ["i-love-yous", "good-mornings", "message-count", "word-count", "chat-span", "top-emoji", "busiest-day"],
  work: ["message-count", "chat-span", "busiest-hour", "top-emoji", "message-share", "media"],
  roast: ["message-count", "word-count", "chat-span", "busiest-day", "busiest-hour", "laughs", "conversation-starts"],
};

export function formatCount(value: number): string {
  return integer.format(value);
}

export function formatNovelsComparison(novelsEquivalent: number): string | null {
  if (novelsEquivalent < 1) return null;
  return `≈ ${formatCount(novelsEquivalent)} ${novelsEquivalent === 1 ? "novel" : "novels"}`;
}

export function formatWordCountWithNovels(totalWords: number, novelsEquivalent: number): string {
  const words = `${formatCount(totalWords)} words`;
  const comparison = formatNovelsComparison(novelsEquivalent);
  return comparison ? `${words} · ${comparison}` : words;
}

export function formatReplyTime(minutes: number, replyCount = 1): string {
  if (replyCount === 0) return "n/a";
  if (minutes < 1) return "<1m";
  if (minutes < 60) return `${Math.round(minutes)}m`;
  if (minutes < 1_440) return `${round(minutes / 60)}h`;
  return `${round(minutes / 1_440)}d`;
}

/** Format a date-only local value without constructing a UTC-based Date. */
export function formatLocalReportDate(localDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(localDate);
  if (!match) return localDate;
  const month = MONTHS[Number(match[2]) - 1];
  return month ? `${Number(match[3])} ${month} ${match[1]}` : localDate;
}

export function formatSpanLabel(spanDays: number): string {
  if (spanDays >= 365) return `${Math.max(1, Math.round(spanDays / 365))} years, in messages`;
  if (spanDays >= 60) return `${Math.max(1, Math.round(spanDays / 30))} months, in messages`;
  return `${spanDays} days, in messages`;
}

export function formatParticipantTitle(people: readonly { name: string }[]): string {
  const names = people.map((person) => person.name);
  if (names.length <= 3) return names.join(" & ");
  return `${names[0]} & ${names.length - 1} others`;
}

export type SweetheartStatCard = ModeStatCard;

export function buildSweetheartStatCards(stats: ReportStats): SweetheartStatCard[] {
  return buildModeStatCards("sweetheart", stats);
}

/** Return up to four metrics with real signal; fixed UI slots never force filler. */
export function buildModeStatCards(mode: ReportMode, stats: ReportStats): ModeStatCard[] {
  const seen = new Set<StatMetric>();
  return [...getModePreset(mode).statMetrics, ...FALLBACK_METRICS[mode]]
    .filter((metric) => {
      if (seen.has(metric)) return false;
      seen.add(metric);
      return true;
    })
    .map((metric) => buildStatCard(metric, stats))
    .filter((card): card is ModeStatCard => card !== null)
    .slice(0, 4);
}

function buildStatCard(metric: StatMetric, stats: ReportStats): ModeStatCard | null {
  const initiator = maxPerson(stats.people, (person) => person.conversationStarts);
  const lateNight = maxPerson(stats.people, (person) => person.lateNightCount);
  const mainCharacter = maxPerson(stats.people, (person) => person.messageShare);
  const comedian = maxPerson(stats.people, (person) => person.laughCount);
  const lastOfDay = maxPerson(stats.people, (person) => person.lastOfDayCount);
  const starts = stats.people.reduce((total, person) => total + person.conversationStarts, 0);
  const startsShare = starts > 0 ? Math.round((initiator.conversationStarts / starts) * 100) : 0;
  const lastOfDayShare = stats.totalMessages > 0 ? lastOfDay.lastOfDayCount / stats.totalMessages : 0;
  const busiestHour = maxIndex(stats.messagesByHour);
  const topEmoji = stats.topEmojis[0];

  switch (metric) {
    case "conversation-starts":
      return starts >= 4 && startsShare >= 55
        ? { label: "texts first", value: `${startsShare}%`, detail: `${initiator.name} · ${formatCount(initiator.conversationStarts)} conversation starts` }
        : null;
    case "reply-time":
      return stats.people.every((person) => person.replyCount > 0)
        ? { label: "avg reply", value: stats.people.map((person) => formatReplyTime(person.medianReplyTimeMin, person.replyCount)).join(" / "), detail: stats.people.map((person) => person.name).join(" / ") }
        : null;
    case "streak":
      return stats.longestStreakDays >= 2
        ? { label: "longest streak", value: `${formatCount(stats.longestStreakDays)}d`, detail: "everyone active, day after day" }
        : null;
    case "late-night":
      return lateNight.lateNightCount >= 3
        ? { label: "midnight to 4am", value: lateNight.name, detail: `${formatCount(lateNight.lateNightCount)} late-night messages` }
        : null;
    case "message-share":
      return mainCharacter.messageCount >= 5 && mainCharacter.messageShare >= 0.55
        ? { label: "main character", value: `${Math.round(mainCharacter.messageShare * 100)}%`, detail: `${mainCharacter.name} · ${formatCount(mainCharacter.messageCount)} messages` }
        : null;
    case "laughs":
      return comedian.laughCount >= 3
        ? { label: "laugh track", value: comedian.name, detail: `${formatCount(comedian.laughCount)} laughs` }
        : null;
    case "last-of-day":
      return lastOfDay.lastOfDayCount >= 3 && lastOfDayShare >= 0.55
        ? { label: "last word", value: lastOfDay.name, detail: `${formatCount(lastOfDay.lastOfDayCount)} days closed out` }
        : null;
    case "media":
      return stats.mediaCount >= 3
        ? { label: "camera roll", value: formatCount(stats.mediaCount), detail: "media moments shared" }
        : null;
    case "busiest-day":
      return stats.busiestDay.count >= 3
        ? { label: "peak traffic", value: formatCount(stats.busiestDay.count), detail: formatLocalReportDate(stats.busiestDay.date) }
        : null;
    case "word-count":
      return stats.totalWords >= 40
        ? { label: "word count", value: formatCount(stats.totalWords), detail: formatNovelsComparison(stats.novelsEquivalent) ?? "a lot said out loud" }
        : null;
    case "silence":
      return stats.longestSilenceDays >= 2
        ? { label: "dry spell", value: `${formatCount(stats.longestSilenceDays)}d`, detail: "longest complete silence" }
        : null;
    case "message-count":
      return stats.totalMessages >= 20
        ? { label: "message count", value: formatCount(stats.totalMessages), detail: "texts worth keeping receipts for" }
        : null;
    case "chat-span":
      return stats.spanDays >= 7
        ? { label: "time together", value: formatSpanLabel(stats.spanDays).replace(", in messages", ""), detail: "of real chat history" }
        : null;
    case "busiest-hour":
      return busiestHour.count >= 4
        ? { label: "peak hour", value: formatClockHour(busiestHour.index), detail: `${formatCount(busiestHour.count)} messages in the chat's busiest hour` }
        : null;
    case "top-emoji":
      return topEmoji && topEmoji.count >= 3
        ? { label: "most used emoji", value: topEmoji.emoji, detail: `${formatCount(topEmoji.count)} times in the chat` }
        : null;
    case "good-mornings":
      return stats.goodMorningCount >= 2
        ? { label: "good mornings", value: formatCount(stats.goodMorningCount), detail: "soft launches into the day" }
        : null;
    case "i-love-yous":
      return stats.iLoveYouCount >= 2
        ? { label: "love yous", value: formatCount(stats.iLoveYouCount), detail: "said out loud in the chat" }
        : null;
  }
}

function maxPerson(people: readonly PersonStats[], metric: (person: PersonStats) => number): PersonStats {
  return people.reduce((winner, person) => (metric(person) > metric(winner) ? person : winner));
}

function maxIndex(values: readonly number[]): { index: number; count: number } {
  return values.reduce(
    (best, count, index) => (count > best.count ? { index, count } : best),
    { index: 0, count: 0 },
  );
}

function formatClockHour(hour: number): string {
  const suffix = hour < 12 ? "am" : "pm";
  return `${hour % 12 || 12}${suffix}`;
}

function round(value: number): string {
  return Number(value.toFixed(1)).toString();
}
