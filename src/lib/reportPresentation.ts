import type { PersonStats, ReportStats } from "./types";

export interface SweetheartStatCard {
  label: string;
  value: string;
  detail: string;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const integer = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

export function formatCount(value: number): string {
  return integer.format(value);
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

export function buildSweetheartStatCards(stats: ReportStats): SweetheartStatCard[] {
  const initiator = maxPerson(stats.people, (person) => person.conversationStarts);
  const lateNight = maxPerson(stats.people, (person) => person.lateNightCount);
  const starts = stats.people.reduce((total, person) => total + person.conversationStarts, 0);
  const startsShare = starts > 0 ? Math.round((initiator.conversationStarts / starts) * 100) : 0;

  return [
    {
      label: "texts first",
      value: `${startsShare}%`,
      detail: `${initiator.name} · ${formatCount(initiator.conversationStarts)} conversation starts`,
    },
    {
      label: "avg reply",
      value: stats.people.map((person) => formatReplyTime(person.medianReplyTimeMin)).join(" / "),
      detail: stats.people.map((person) => person.name).join(" / "),
    },
    {
      label: "longest streak",
      value: `${formatCount(stats.longestStreakDays)}d`,
      detail: "everyone active, day after day",
    },
    {
      label: "midnight–4am",
      value: lateNight.name,
      detail: `${formatCount(lateNight.lateNightCount)} late-night messages`,
    },
  ];
}

function maxPerson(people: readonly PersonStats[], metric: (person: PersonStats) => number): PersonStats {
  return people.reduce((winner, person) => (metric(person) > metric(winner) ? person : winner));
}

function round(value: number): string {
  return Number(value.toFixed(1)).toString();
}
