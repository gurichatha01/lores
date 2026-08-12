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
