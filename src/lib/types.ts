export interface Message {
  timestamp: Date;
  sender: string;
  text: string;
  wordCount: number;
  hasEmoji: boolean;
  emojis: string[];
}

export interface ParsedWhatsAppExport {
  messages: Message[];
  mediaCount: number;
  mediaBySender?: Record<string, number>;
}

export interface PersonStats {
  name: string;
  messageCount: number;
  messageShare: number;
  wordCount: number;
  avgWordsPerMessage: number;
  medianReplyTimeMin: number;
  replyCount: number;
  conversationStarts: number;
  lastOfDayCount: number;
  lateNightCount: number;
  laughCount: number;
  profanityMessageCount: number;
  emojiCount: number;
  emojisPerMessage: number;
  linkCount: number;
  mediaCount: number;
  maxConsecutiveMessages: number;
  silenceRevivalCount: number;
  weekendMessageCount: number;
  weekendShare: number;
  activeSpanShare: number;
  soloRate: number;
  threadKillerCount: number;
  conversationStartCount: number;
  ghostStreakCount: number;
  responseRate: number;
  topEmojis: { emoji: string; count: number }[];
  topWords: string[];
}

export interface MonthlyMessageCount {
  month: string; // local YYYY-MM
  count: number;
}

export interface ReplyTimeBucket {
  label: "<1m" | "1-5m" | "5-30m" | "30m-2h" | "2-4h" | "4-6h";
  count: number;
}

export interface SilenceRange {
  startDate: Date;
  endDate: Date;
  days: number;
}

export interface ChatStats {
  isGroup: boolean;
  people: PersonStats[];
  totalMessages: number;
  totalWords: number;
  novelsEquivalent: number;
  mediaCount: number;
  firstMessageDate: Date;
  lastMessageDate: Date;
  spanDays: number;
  busiestDay: { date: Date; count: number };
  longestStreakDays: number;
  longestSilenceDays: number;
  messagesByHour: number[];
  messagesByWeekday: number[];
  messagesByMonth: MonthlyMessageCount[];
  replyTimeDistribution: ReplyTimeBucket[];
  topEmojis: { emoji: string; count: number }[];
  goodMorningCount: number;
  iLoveYouCount: number;
  firstLateNightDate: Date | null;
  firstRelationshipTalkDate: Date | null;
  longestSilenceRange: SilenceRange | null;
}

export interface Award {
  id: string;
  label: string;
  emoji: string;
  who: string;
  detail: string;
}

export type ReportMode =
  | "sweetheart"
  | "ride-or-die"
  | "group"
  | "family"
  | "work"
  | "roast";

export interface ReportContent {
  title: string;
  heroLine: string;
  wrappedLine: string;
  highlights: {
    label: string;
    body: string;
    snippet: ReceiptSnippet;
  }[];
  awardLines: { awardId: string; line: string }[];
  narrative: string;
  chapters: { title: string; body: string }[];
}

export interface ReceiptSnippetMessage {
  messageIndex: number;
  timestamp: string;
  sender: string;
  text: string;
}

export interface ReceiptSnippet {
  exchangeId: string;
  startIndex: number;
  endIndex: number;
  startTimestamp: string;
  endTimestamp: string;
  messages: ReceiptSnippetMessage[];
}

export type ReceiptExchange = ReceiptSnippet;

/** ChatStats serialized without converting local wall-clock dates to UTC. */
export interface ReportStats extends Omit<
  ChatStats,
  | "firstMessageDate"
  | "lastMessageDate"
  | "busiestDay"
  | "firstLateNightDate"
  | "firstRelationshipTalkDate"
  | "longestSilenceRange"
> {
  firstMessageDate: string;
  lastMessageDate: string;
  busiestDay: { date: string; count: number };
  firstLateNightDate: string | null;
  firstRelationshipTalkDate: string | null;
  longestSilenceRange: { startDate: string; endDate: string; days: number } | null;
}

/** A curated Message serialized without converting its local timestamp to UTC. */
export interface ReportSampleMessage extends Omit<Message, "timestamp"> {
  timestamp: string;
}

export interface GenerateReportInput {
  mode: ReportMode;
  subtype: string;
  userContext: string;
  stats: ReportStats;
  awards: Award[];
  sample: ReportSampleMessage[];
  receiptExchanges: ReceiptExchange[];
}

export interface ReportSessionData {
  reportId: string;
  mode: ReportMode;
  subtype: string;
  stats: ReportStats;
  awards: Award[];
  content: ReportContent;
}
