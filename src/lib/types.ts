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
}

export interface PersonStats {
  name: string;
  messageCount: number;
  messageShare: number;
  wordCount: number;
  avgWordsPerMessage: number;
  medianReplyTimeMin: number;
  conversationStarts: number;
  lastOfDayCount: number;
  lateNightCount: number;
  laughCount: number;
  topEmojis: { emoji: string; count: number }[];
  topWords: string[];
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
}

export interface Award {
  id: string;
  label: string;
  emoji: string;
  who: string;
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
  highlights: { label: string; body: string; bubble?: string }[];
  awardLines: { awardId: string; line: string }[];
  narrative: string;
  chapters?: { title: string; body: string }[];
}

/** ChatStats serialized without converting local wall-clock dates to UTC. */
export interface ReportStats extends Omit<ChatStats, "firstMessageDate" | "lastMessageDate" | "busiestDay"> {
  firstMessageDate: string;
  lastMessageDate: string;
  busiestDay: { date: string; count: number };
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
}

export interface ReportSessionData {
  mode: ReportMode;
  subtype: string;
  stats: ReportStats;
  awards: Award[];
  content: ReportContent;
}
