import type {
  Award,
  ChatStats,
  GenerateReportInput,
  Message,
  ReportMode,
  ReceiptExchange,
  ReportSampleMessage,
  ReportStats,
} from "./types";

export interface CreateGenerateReportInput {
  mode: ReportMode;
  subtype: string;
  userContext: string;
  stats: ChatStats;
  awards: readonly Award[];
  sample: readonly Message[];
  receiptExchanges?: readonly ReceiptExchange[];
}

/** Serialize an API payload while preserving WhatsApp's naive local frame. */
export function serializeGenerateReportInput(
  input: CreateGenerateReportInput,
): GenerateReportInput {
  return {
    mode: input.mode,
    subtype: input.subtype,
    userContext: input.userContext,
    stats: serializeStats(input.stats),
    awards: input.awards.map((award) => ({ ...award })),
    sample: input.sample.map(serializeMessage),
    receiptExchanges: (input.receiptExchanges ?? []).map((exchange) => ({
      ...exchange,
      messages: exchange.messages.map((message) => ({ ...message })),
    })),
  };
}

export function formatLocalDate(date: Date): string {
  assertValidDate(date);
  return [date.getFullYear(), pad(date.getMonth() + 1), pad(date.getDate())].join("-");
}

export function formatLocalDateTime(date: Date): string {
  assertValidDate(date);
  return `${formatLocalDate(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(
    date.getSeconds(),
  )}`;
}

function serializeStats(stats: ChatStats): ReportStats {
  return {
    ...stats,
    people: stats.people.map((person) => ({
      ...person,
      topEmojis: person.topEmojis.map((entry) => ({ ...entry })),
      topWords: [...person.topWords],
    })),
    firstMessageDate: formatLocalDateTime(stats.firstMessageDate),
    lastMessageDate: formatLocalDateTime(stats.lastMessageDate),
    busiestDay: {
      date: formatLocalDate(stats.busiestDay.date),
      count: stats.busiestDay.count,
    },
    firstLateNightDate: stats.firstLateNightDate ? formatLocalDateTime(stats.firstLateNightDate) : null,
    firstRelationshipTalkDate: stats.firstRelationshipTalkDate
      ? formatLocalDateTime(stats.firstRelationshipTalkDate)
      : null,
    longestSilenceRange: stats.longestSilenceRange
      ? {
          startDate: formatLocalDate(stats.longestSilenceRange.startDate),
          endDate: formatLocalDate(stats.longestSilenceRange.endDate),
          days: stats.longestSilenceRange.days,
        }
      : null,
    messagesByHour: [...stats.messagesByHour],
    messagesByWeekday: [...stats.messagesByWeekday],
    messagesByMonth: stats.messagesByMonth.map((entry) => ({ ...entry })),
    replyTimeDistribution: stats.replyTimeDistribution.map((entry) => ({ ...entry })),
    topEmojis: stats.topEmojis.map((entry) => ({ ...entry })),
  };
}

function serializeMessage(message: Message): ReportSampleMessage {
  return {
    ...message,
    timestamp: formatLocalDateTime(message.timestamp),
    emojis: [...message.emojis],
  };
}

function assertValidDate(date: Date): void {
  if (Number.isNaN(date.getTime())) {
    throw new Error("Cannot serialize an invalid date.");
  }
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}
