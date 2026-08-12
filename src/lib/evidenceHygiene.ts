import type { Message } from "./types";

const URL = /(?:https?:\/\/|www\.)\S+/giu;
const MAP_LINK = /(?:maps\.app\.goo\.gl|goo\.gl\/maps|google\.[^\s/]+\/maps|maps\.apple\.com)/iu;
const PHONE_NUMBER = /(?<![\p{L}\p{N}])(?:\+?\d[\d\s().-]{7,}\d)(?![\p{L}\p{N}])/gu;
const MEDIA_ONLY = /^\s*(?:<media omitted>|image omitted|video omitted|audio omitted|sticker omitted|document omitted|gif omitted)\s*$/iu;
const ADDRESS_HINT = /\b(?:sector|road|rd|street|st|lane|block|floor|flat|apartment|apt|house|plot|building|tower|colony|nagar|district|pincode|pin code|zip code)\b/iu;
const POSTAL_CODE = /\b\d{5,6}\b/u;
const ADDRESS_SEPARATOR = /(?:,|·|\|)/gu;
const FILLER_ONLY = /^\s*(?:ok(?:ay)?|k|haan+|han+|h+m+|hmm+|acha+|accha+|theek|thik|sure|yep|yup|yes|nah|no|fine|cool|done|noted|👍|👌)[\s.!?…]*$/iu;
const WORD = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu;

/** Remove private/noisy fragments before a message can become LLM evidence. */
export function sanitizeEvidenceText(text: string): string | null {
  const normalized = text.replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/gu, " ").trim();
  if (!normalized || MEDIA_ONLY.test(normalized) || FILLER_ONLY.test(normalized)) return null;
  if (looksLikeAddress(normalized)) return null;

  const cleaned = normalized
    .replace(URL, " ")
    .replace(PHONE_NUMBER, " ")
    .replace(/\s+/gu, " ")
    .replace(/^\s*[-–—·|,:;]+|[-–—·|,:;]+\s*$/gu, "")
    .trim();

  if (!cleaned || FILLER_ONLY.test(cleaned) || !/[\p{L}\p{N}\p{Extended_Pictographic}]/u.test(cleaned)) {
    return null;
  }
  return cleaned;
}

export function sanitizeEvidenceMessage(message: Message): Message | null {
  const text = sanitizeEvidenceText(message.text);
  if (!text) return null;
  return {
    ...message,
    text,
    wordCount: text.match(WORD)?.length ?? 0,
    emojis: [...message.emojis],
  };
}

function looksLikeAddress(text: string): boolean {
  if (MAP_LINK.test(text)) return true;
  const separators = text.match(ADDRESS_SEPARATOR)?.length ?? 0;
  if (POSTAL_CODE.test(text) && (ADDRESS_HINT.test(text) || separators >= 2)) return true;
  return ADDRESS_HINT.test(text) && (/\b\d{1,4}[a-z]?\b/iu.test(text) || separators >= 1);
}
