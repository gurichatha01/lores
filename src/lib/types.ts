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
