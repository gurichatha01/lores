export interface StoryTimelineChapter {
  title: string;
  body: string;
}

export interface StoryTimelineTick {
  chapterIndex: number;
  date: string | null;
  dateLabel: string;
  isBusiestDay: boolean;
  busiestDayLabel: string | null;
}

export interface StoryTimelineStats {
  firstMessageDate: string;
  lastMessageDate: string;
  spanDays: number;
  busiestDay: { date: string; count: number };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function buildStoryTimeline(
  chapters: readonly StoryTimelineChapter[],
  stats: StoryTimelineStats,
): StoryTimelineTick[] {
  if (chapters.length === 0) return [];

  const range = resolveDateRange(stats);
  const busiestTime = parseDateOnly(stats.busiestDay?.date);
  const busiestIndex = pickBusiestChapterIndex(
    chapters.length,
    range.first,
    range.last,
    busiestTime,
  );
  const busiestDate = formatFullDate(stats.busiestDay?.date);
  const busiestCount = safeCount(stats.busiestDay?.count);

  return chapters.map((_, index) => {
    const time = interpolateDate(range.first, range.last, index, chapters.length);
    const date = time === null ? null : toDateOnly(time);
    const isBusiestDay = index === busiestIndex;
    return {
      chapterIndex: index + 1,
      date,
      dateLabel: date ? formatMonthYear(date) : "Date unknown",
      isBusiestDay,
      busiestDayLabel: isBusiestDay ? `${busiestDate} · ${busiestCount} msgs` : null,
    };
  });
}

function resolveDateRange(stats: StoryTimelineStats): { first: number | null; last: number | null } {
  let first = parseDateOnly(stats.firstMessageDate);
  let last = parseDateOnly(stats.lastMessageDate);
  const spanMs = Math.max(0, safeCount(stats.spanDays) - 1) * 86_400_000;

  if (first === null && last !== null) first = last - spanMs;
  if (last === null && first !== null) last = first + spanMs;
  if (first !== null && last !== null && last < first) last = first;
  return { first, last };
}

function pickBusiestChapterIndex(
  chapterCount: number,
  first: number | null,
  last: number | null,
  busiest: number | null,
): number {
  if (chapterCount <= 1 || first === null || last === null || busiest === null || last <= first) return 0;
  const ratio = Math.min(1, Math.max(0, (busiest - first) / (last - first)));
  return Math.round(ratio * (chapterCount - 1));
}

function interpolateDate(
  first: number | null,
  last: number | null,
  index: number,
  count: number,
): number | null {
  if (first === null || last === null) return null;
  if (count <= 1) return first;
  if (index === 0) return first;
  if (index === count - 1) return last;
  const totalDays = Math.round((last - first) / 86_400_000);
  const dayOffset = Math.round((totalDays * index) / (count - 1));
  return first + dayOffset * 86_400_000;
}

function parseDateOnly(value: string | null | undefined): number | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/u.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const time = Date.UTC(year, month - 1, day);
  const date = new Date(time);
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) return null;
  return time;
}

function toDateOnly(time: number): string {
  const date = new Date(time);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function formatMonthYear(value: string): string {
  const time = parseDateOnly(value);
  if (time === null) return "Date unknown";
  const date = new Date(time);
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

function formatFullDate(value: string | null | undefined): string {
  const time = parseDateOnly(value);
  if (time === null) return "date unknown";
  const date = new Date(time);
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

function safeCount(value: number | null | undefined): number {
  return Number.isFinite(value) ? Math.max(0, Math.round(value!)) : 0;
}
