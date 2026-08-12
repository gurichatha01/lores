import JSZip, { type JSZipObject } from "jszip";

import type { Message, ParsedWhatsAppExport } from "./types";

export type WhatsAppDateOrder = "DMY" | "MDY";

export interface ParseWhatsAppOptions {
  /** Defaults to auto-detection, falling back to DMY when every date is ambiguous. */
  dateOrder?: WhatsAppDateOrder | "auto";
  /** Optional escape hatch for inherently ambiguous one-off sender names containing a colon. */
  participants?: readonly string[];
}

export type WhatsAppInput = string | Blob | File;

interface HeaderParts {
  firstDatePart: number;
  secondDatePart: number;
  year: number;
  hour: number;
  minute: number;
  second: number;
  meridiem?: "AM" | "PM";
  payload: string;
}

interface RawEntry extends HeaderParts {
  continuationLines: string[];
}

interface TextParseDetails extends ParsedWhatsAppExport {
  omittedMediaCount: number;
  attachedMediaReferenceCount: number;
}

interface SenderSplit {
  sender: string;
  text: string;
}

const INVISIBLE_DIRECTIONAL_MARKS = /[\u200e\u200f\u202a-\u202e\u2066-\u2069\ufeff]/gu;
const INVISIBLE_SPACES = /[\u00a0\u202f]/gu;
const IOS_HEADER =
  /^\[(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4}),\s*(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([ap]\.?m\.?)?\]\s*(.*)$/iu;
const ANDROID_12_HOUR_DASH_HEADER =
  /^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([ap]\.?m\.?)\s*-\s*(.*)$/iu;
const ANDROID_HEADER =
  /^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([ap]\.?m\.?)?\s*(?:-|–|—)\s*(.*)$/iu;
const WORD = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu;
const EMOJI_SEQUENCE =
  /(?:\p{Regional_Indicator}{2}|[#*0-9]\uFE0F?\u20E3|\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?\p{Emoji_Modifier}?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?\p{Emoji_Modifier}?)*)/gu;

const MEDIA_OMITTED =
  /^<?(?:media|image|video|audio|sticker|gif|document|contact card) omitted>?$/iu;
const ATTACHED_FILE_REFERENCE =
  /^(?:.+\.(?:jpe?g|png|webp|gif|heic|heif|mp4|mov|3gp|avi|mkv|webm|m4a|mp3|wav|opus|ogg|aac|pdf|docx?|xlsx?|pptx?|vcf)\s+\(file attached\)|<attached:\s*.+>)$/iu;
const DELETED_MESSAGE = /^(?:this message was deleted|you deleted this message|message deleted)$/iu;
const FORWARDED_LINE = /^(?:<|\[)?forwarded(?: many times| message)?(?:>|\])?$/iu;
const FORWARDED_PREFIX = /^(?:<|\[)?forwarded(?: many times| message)?(?:>|\])?\s*:\s*/iu;
const EDITED_MARKER =
  /^(?:<?this message was edited>?|\[(?:edited|message edited)\]|\((?:edited|message edited)\))$/iu;

export class WhatsAppParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WhatsAppParseError";
  }
}

/**
 * Parse a browser File/Blob containing a WhatsApp .txt or .zip export.
 * Passing a string parses it directly as raw exported chat text.
 */
export async function parseWhatsApp(
  input: WhatsAppInput,
  options: ParseWhatsAppOptions = {},
): Promise<ParsedWhatsAppExport> {
  if (typeof input === "string") {
    return parseWhatsAppText(input, options);
  }

  const name = "name" in input && typeof input.name === "string" ? input.name.toLowerCase() : "";
  const bytes = await input.arrayBuffer();
  const isZip = name.endsWith(".zip") || hasZipSignature(bytes);

  if (isZip) {
    return parseWhatsAppZip(bytes, options);
  }

  if (name && !name.endsWith(".txt")) {
    throw new WhatsAppParseError("Choose a WhatsApp .txt or .zip export.");
  }

  return parseWhatsAppText(new TextDecoder("utf-8").decode(bytes), options);
}

/** Parse raw WhatsApp export text. The returned `messages` value is the plan's Message[]. */
export function parseWhatsAppText(
  source: string,
  options: ParseWhatsAppOptions = {},
): ParsedWhatsAppExport {
  const details = parseTextDetails(source, options);
  return {
    messages: details.messages,
    mediaCount: details.mediaCount,
  };
}

async function parseWhatsAppZip(
  bytes: ArrayBuffer,
  options: ParseWhatsAppOptions,
): Promise<ParsedWhatsAppExport> {
  let zip: JSZip;

  try {
    zip = await JSZip.loadAsync(bytes);
  } catch {
    throw new WhatsAppParseError("That ZIP could not be read.");
  }

  const files = Object.values(zip.files).filter((entry) => !entry.dir);
  const chatFile = chooseChatFile(files);

  if (!chatFile) {
    throw new WhatsAppParseError("No WhatsApp _chat.txt file was found in that ZIP.");
  }

  const details = parseTextDetails(await chatFile.async("string"), options);
  const archivedMediaCount = files.filter(
    (entry) => entry !== chatFile && isArchiveAttachment(entry.name),
  ).length;

  return {
    messages: details.messages,
    // Attached-file text lines refer to files already counted in the ZIP. Omitted
    // placeholders have no corresponding file, so they are added separately.
    mediaCount: archivedMediaCount + details.omittedMediaCount,
  };
}

function parseTextDetails(source: string, options: ParseWhatsAppOptions): TextParseDetails {
  const entries = collectEntries(source);
  const fallbackOrder = inferDateOrder(entries, options.dateOrder ?? "auto");
  const senderFrequency = countSenderCandidates(entries);
  const messages: Message[] = [];
  let omittedMediaCount = 0;
  let attachedMediaReferenceCount = 0;

  for (const entry of entries) {
    const timestamp = makeTimestamp(entry, resolveDateOrder(entry, fallbackOrder));
    if (!timestamp || isSystemPayload(entry.payload)) {
      continue;
    }

    const split = splitSender(entry.payload, senderFrequency, options.participants ?? []);
    if (!split) {
      continue;
    }

    let text = [split.text, ...entry.continuationLines].join("\n");
    text = stripForwardedMarkers(text);
    text = stripEditedMarkers(text);

    const media = stripMediaLines(text);
    omittedMediaCount += media.omittedCount;
    attachedMediaReferenceCount += media.attachedReferenceCount;
    text = media.text;

    if (!text || DELETED_MESSAGE.test(text)) {
      continue;
    }

    const emojis = extractEmojis(text);
    messages.push({
      timestamp,
      sender: cleanVisibleText(split.sender),
      text,
      wordCount: text.match(WORD)?.length ?? 0,
      hasEmoji: emojis.length > 0,
      emojis,
    });
  }

  return {
    messages,
    mediaCount: omittedMediaCount + attachedMediaReferenceCount,
    omittedMediaCount,
    attachedMediaReferenceCount,
  };
}

function collectEntries(source: string): RawEntry[] {
  const entries: RawEntry[] = [];
  let current: RawEntry | undefined;
  const normalizedSource = source.replace(INVISIBLE_SPACES, " ");

  for (const originalLine of normalizedSource.replace(/^\ufeff/u, "").split(/\r?\n/u)) {
    const line = stripDirectionalMarks(originalLine);
    const header = parseHeader(line);

    if (header) {
      current = { ...header, continuationLines: [] };
      entries.push(current);
      continue;
    }

    if (current) {
      current.continuationLines.push(cleanVisibleText(line));
    }
  }

  return entries;
}

function parseHeader(line: string): HeaderParts | undefined {
  const match =
    IOS_HEADER.exec(line) ??
    ANDROID_12_HOUR_DASH_HEADER.exec(line) ??
    ANDROID_HEADER.exec(line);
  if (!match) {
    return undefined;
  }

  const meridiem = match[7]?.replaceAll(".", "").toUpperCase() as "AM" | "PM" | undefined;

  return {
    firstDatePart: Number(match[1]),
    secondDatePart: Number(match[2]),
    year: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: Number(match[6] ?? 0),
    meridiem,
    payload: cleanVisibleText(match[8]),
  };
}

function inferDateOrder(
  entries: readonly RawEntry[],
  requested: WhatsAppDateOrder | "auto",
): WhatsAppDateOrder {
  if (requested !== "auto") {
    return requested;
  }

  let dmyEvidence = 0;
  let mdyEvidence = 0;

  for (const entry of entries) {
    if (entry.firstDatePart > 12 && entry.secondDatePart <= 12) {
      dmyEvidence += 1;
    } else if (entry.secondDatePart > 12 && entry.firstDatePart <= 12) {
      mdyEvidence += 1;
    }
  }

  return mdyEvidence > dmyEvidence ? "MDY" : "DMY";
}

function resolveDateOrder(entry: HeaderParts, fallback: WhatsAppDateOrder): WhatsAppDateOrder {
  if (entry.firstDatePart > 12 && entry.secondDatePart <= 12) {
    return "DMY";
  }
  if (entry.secondDatePart > 12 && entry.firstDatePart <= 12) {
    return "MDY";
  }
  return fallback;
}

function makeTimestamp(parts: HeaderParts, order: WhatsAppDateOrder): Date | undefined {
  const day = order === "DMY" ? parts.firstDatePart : parts.secondDatePart;
  const month = order === "DMY" ? parts.secondDatePart : parts.firstDatePart;
  const year = parts.year < 100 ? (parts.year >= 70 ? 1900 + parts.year : 2000 + parts.year) : parts.year;
  let hour = parts.hour;

  if (parts.meridiem) {
    if (hour < 1 || hour > 12) {
      return undefined;
    }
    hour = hour % 12 + (parts.meridiem === "PM" ? 12 : 0);
  }

  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hour < 0 ||
    hour > 23 ||
    parts.minute < 0 ||
    parts.minute > 59 ||
    parts.second < 0 ||
    parts.second > 59
  ) {
    return undefined;
  }

  const timestamp = new Date(year, month - 1, day, hour, parts.minute, parts.second);
  if (
    timestamp.getFullYear() !== year ||
    timestamp.getMonth() !== month - 1 ||
    timestamp.getDate() !== day
  ) {
    return undefined;
  }

  return timestamp;
}

function countSenderCandidates(entries: readonly RawEntry[]): Map<string, number> {
  const counts = new Map<string, number>();

  for (const entry of entries) {
    if (isSystemPayload(entry.payload)) {
      continue;
    }

    for (const candidate of findSenderCandidates(entry.payload)) {
      counts.set(candidate.sender, (counts.get(candidate.sender) ?? 0) + 1);
    }
  }

  return counts;
}

function findSenderCandidates(payload: string): Array<SenderSplit> {
  const candidates: SenderSplit[] = [];

  for (let index = 0; index < payload.length; index += 1) {
    if (payload[index] !== ":") {
      continue;
    }

    const nextCharacter = payload[index + 1];
    if (nextCharacter !== undefined && !/\s/u.test(nextCharacter)) {
      continue;
    }

    const sender = cleanVisibleText(payload.slice(0, index));
    if (!sender || sender.length > 100 || sender.includes("\n")) {
      continue;
    }

    candidates.push({
      sender,
      text: cleanVisibleText(payload.slice(index + 1)),
    });
  }

  return candidates;
}

function splitSender(
  payload: string,
  frequency: ReadonlyMap<string, number>,
  participants: readonly string[],
): SenderSplit | undefined {
  const explicitMatches = participants
    .map(cleanVisibleText)
    .filter((participant) => payload.startsWith(`${participant}:`))
    .sort((left, right) => right.length - left.length);

  if (explicitMatches[0]) {
    const sender = explicitMatches[0];
    return {
      sender,
      text: cleanVisibleText(payload.slice(sender.length + 1)),
    };
  }

  const candidates = findSenderCandidates(payload);
  if (candidates.length === 0) {
    return undefined;
  }

  const repeatedCandidates = candidates
    .filter((candidate) => (frequency.get(candidate.sender) ?? 0) >= 2)
    .sort(
      (left, right) =>
        (frequency.get(right.sender) ?? 0) - (frequency.get(left.sender) ?? 0) ||
        right.sender.length - left.sender.length,
    );

  return repeatedCandidates[0] ?? candidates[0];
}

function stripForwardedMarkers(text: string): string {
  const lines = text.split("\n");
  while (lines[0] && FORWARDED_LINE.test(lines[0].trim())) {
    lines.shift();
  }

  if (lines[0]) {
    lines[0] = lines[0].replace(FORWARDED_PREFIX, "");
  }

  return cleanMultilineText(lines.join("\n"));
}

function stripEditedMarkers(text: string): string {
  const lines = text.split("\n");
  while (lines.at(-1) && EDITED_MARKER.test(lines.at(-1)!.trim())) {
    lines.pop();
  }

  if (lines.at(-1)) {
    lines[lines.length - 1] = lines.at(-1)!.replace(
      /\s+(?:<?this message was edited>?|\[(?:edited|message edited)\]|\((?:edited|message edited)\))\s*$/iu,
      "",
    );
  }
  return cleanMultilineText(lines.join("\n"));
}

function stripMediaLines(text: string): {
  text: string;
  omittedCount: number;
  attachedReferenceCount: number;
} {
  let omittedCount = 0;
  let attachedReferenceCount = 0;
  const keptLines: string[] = [];

  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (MEDIA_OMITTED.test(trimmed)) {
      omittedCount += 1;
    } else if (ATTACHED_FILE_REFERENCE.test(trimmed)) {
      attachedReferenceCount += 1;
    } else {
      keptLines.push(line);
    }
  }

  return {
    text: cleanMultilineText(keptLines.join("\n")),
    omittedCount,
    attachedReferenceCount,
  };
}

function isSystemPayload(text: string): boolean {
  const normalized = cleanMultilineText(text).toLowerCase();
  return (
    /messages and calls are end-to-end encrypted/u.test(normalized) ||
    /security code (?:with .+ )?changed/u.test(normalized) ||
    /^(?:you |[^:\n]{1,100} )?(?:created (?:this )?group|changed the (?:subject|group description)|changed this group's icon)/u.test(
      normalized,
    ) ||
    /^(?:you |[^:\n]{1,100} )?(?:added|removed) .+/u.test(normalized) ||
    /^(?:you |[^:\n]{1,100} )?(?:left|joined using this group's invite link)$/u.test(normalized) ||
    /^(?:you |[^:\n]{1,100} )?(?:turned on|turned off|changed) disappearing messages/u.test(normalized) ||
    /^(?:you |[^:\n]{1,100} )?pinned a message/u.test(normalized) ||
    /^waiting for this message/u.test(normalized)
  );
}

function extractEmojis(text: string): string[] {
  return Array.from(text.matchAll(EMOJI_SEQUENCE), (match) => match[0]);
}

function chooseChatFile(files: readonly JSZipObject[]): JSZipObject | undefined {
  return [...files]
    .filter((entry) => entry.name.toLowerCase().endsWith(".txt"))
    .sort((left, right) => chatFilePriority(left.name) - chatFilePriority(right.name))[0];
}

function chatFilePriority(name: string): number {
  const normalized = name.replaceAll("\\", "/").toLowerCase();
  const baseName = normalized.split("/").at(-1);
  return (baseName === "_chat.txt" ? 0 : 1_000) + normalized.length;
}

function isArchiveAttachment(name: string): boolean {
  const normalized = name.replaceAll("\\", "/");
  const parts = normalized.split("/");
  const baseName = parts.at(-1) ?? "";

  return (
    !normalized.toLowerCase().endsWith(".txt") &&
    !normalized.startsWith("__MACOSX/") &&
    !parts.some((part) => part.startsWith(".")) &&
    !baseName.startsWith(".")
  );
}

function hasZipSignature(bytes: ArrayBuffer): boolean {
  const signature = new Uint8Array(bytes, 0, Math.min(4, bytes.byteLength));
  return (
    signature.length >= 4 &&
    signature[0] === 0x50 &&
    signature[1] === 0x4b &&
    ((signature[2] === 0x03 && signature[3] === 0x04) ||
      (signature[2] === 0x05 && signature[3] === 0x06) ||
      (signature[2] === 0x07 && signature[3] === 0x08))
  );
}

function stripDirectionalMarks(text: string): string {
  return text.replace(INVISIBLE_DIRECTIONAL_MARKS, "");
}

function cleanVisibleText(text: string): string {
  return stripDirectionalMarks(text).trim();
}

function cleanMultilineText(text: string): string {
  return stripDirectionalMarks(text)
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();
}
