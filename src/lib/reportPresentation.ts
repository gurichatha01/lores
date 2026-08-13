import type { PersonStats, ReportStats } from "./types";
import { getModePreset, type StatMetric } from "./modePresets";
import type { ReportMode } from "./types";

export interface ModeStatCard {
  label: string;
  value: string;
  detail: string;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const integer = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

export function formatCount(value: number): string {
  return integer.format(value);
}

export function formatNovelsComparison(novelsEquivalent: number): string | null {
  if (novelsEquivalent < 1) return null;
  return `≈ ${formatCount(novelsEquivalent)} ${
    novelsEquivalent === 1 ? "novel" : "novels"
  }`;
}

export function formatWordCountWithNovels(
  totalWords: number,
  novelsEquivalent: number,
): string {
  const words = `${formatCount(totalWords)} words`;
  const comparison = formatNovelsComparison(novelsEquivalent);
  return comparison ? `${words} · ${comparison}` : words;
}

export function formatReplyTime(minutes: number): string {
  if (minutes <= 0) return "—";
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

export function formatParticipantTitle(
  people: readonly { name: string }[],
): string {
  const names = people.map((person) => person.name);
  if (names.length <= 3) return names.join(" & ");
  return `${names[0]} & ${names.length - 1} others`;
}

export function buildSweetheartStatCards(stats: ReportStats): SweetheartStatCard[] {
  return buildModeStatCards("sweetheart", stats);
}

export type SweetheartStatCard = ModeStatCard;

export function buildModeStatCards(mode: ReportMode, stats: ReportStats): ModeStatCard[] {
  return getModePreset(mode).statMetrics.map((metric) => buildStatCard(metric, stats));
}

function buildStatCard(metric: StatMetric, stats: ReportStats): ModeStatCard {
  const initiator = maxPerson(stats.people, (person) => person.conversationStarts);
  const lateNight = maxPerson(stats.people, (person) => person.lateNightCount);
  const mainCharacter = maxPerson(stats.people, (person) => person.messageShare);
  const comedian = maxPerson(stats.people, (person) => person.laughCount);
  const lastOfDay = maxPerson(stats.people, (person) => person.lastOfDayCount);
  const starts = stats.people.reduce((total, person) => total + person.conversationStarts, 0);
  const startsShare = starts > 0 ? Math.round((initiator.conversationStarts / starts) * 100) : 0;

  switch (metric) {
    case "conversation-starts":
      return {
      label: "texts first",
      value: `${startsShare}%`,
      detail: `${initiator.name} · ${formatCount(initiator.conversationStarts)} conversation starts`,
      };
    case "reply-time":
      return {
        label: "avg reply",
        value: stats.people.map((person) => formatReplyTime(person.medianReplyTimeMin)).join(" / "),
        detail: stats.people.map((person) => person.name).join(" / "),
      };
    case "streak":
      return {
        label: "longest streak",
        value: `${formatCount(stats.longestStreakDays)}d`,
        detail: "everyone active, day after day",
      };
    case "late-night":
      return {
        label: "midnight–4am",
        value: lateNight.name,
        detail: `${formatCount(lateNight.lateNightCount)} late-night messages`,
      };
    case "message-share":
      return {
        label: "main character",
        value: `${Math.round(mainCharacter.messageShare * 100)}%`,
        detail: `${mainCharacter.name} · ${formatCount(mainCharacter.messageCount)} messages`,
      };
    case "laughs":
      return {
        label: "laugh track",
        value: comedian.name,
        detail: `${formatCount(comedian.laughCount)} laughs`,
      };
    case "last-of-day":
      return {
        label: "last word",
        value: lastOfDay.name,
        detail: `${formatCount(lastOfDay.lastOfDayCount)} days closed out`,
      };
    case "media":
      return {
        label: "camera roll",
        value: formatCount(stats.mediaCount),
        detail: "media moments shared",
      };
    case "busiest-day":
      return {
        label: "peak traffic",
        value: formatCount(stats.busiestDay.count),
        detail: formatLocalReportDate(stats.busiestDay.date),
      };
    case "word-count":
      return {
        label: "word count",
        value: formatCount(stats.totalWords),
        detail: formatNovelsComparison(stats.novelsEquivalent) ?? "concise and on record",
      };
    case "silence":
      return {
        label: "dry spell",
        value: `${formatCount(stats.longestSilenceDays)}d`,
        detail: "longest complete silence",
      };
  }
}

function maxPerson(people: readonly PersonStats[], metric: (person: PersonStats) => number): PersonStats {
  return people.reduce((winner, person) => (metric(person) > metric(winner) ? person : winner));
}

function round(value: number): string {
  return Number(value.toFixed(1)).toString();
}
