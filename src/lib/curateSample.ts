import type { Message } from "./types";

export const DEFAULT_SAMPLE_PER_PERSON = 25;
export const MIN_SAMPLE_PER_PERSON = 20;
export const MAX_SAMPLE_PER_PERSON = 30;

export interface CurateSampleOptions {
  perPerson?: number;
}

interface RankedMessage {
  message: Message;
  sourceIndex: number;
  score: number;
}

const LAUGH = /(?:\b(?:ha(?:ha)+|he(?:he)+|hi(?:hi)+|lol+|lmao+|lmfao+|rofl+|hehe|bahaha+)\b|😂|🤣|💀)/giu;
const KEYWORD =
  /\b(?:love|miss|sorry|remember|always|never|birthday|anniversary|fight|proud|morning|night|thank|please|together|relationship|date|marry|bestie|friend)\b/giu;

/**
 * Pick a compact, repeatable sample per person. Heuristics reserve room for
 * long messages, laughter, and meaningful keywords; the remainder is drawn
 * pseudo-randomly from time strata so the whole relationship is represented.
 */
export function curateSample(
  messages: readonly Message[],
  options: CurateSampleOptions = {},
): Message[] {
  const perPerson = options.perPerson ?? DEFAULT_SAMPLE_PER_PERSON;
  if (
    !Number.isInteger(perPerson) ||
    perPerson < MIN_SAMPLE_PER_PERSON ||
    perPerson > MAX_SAMPLE_PER_PERSON
  ) {
    throw new Error(
      `perPerson must be an integer from ${MIN_SAMPLE_PER_PERSON} to ${MAX_SAMPLE_PER_PERSON}.`,
    );
  }

  const chronological = messages
    .map((message, sourceIndex) => ({ message, sourceIndex }))
    .filter(({ message }) => !Number.isNaN(message.timestamp.getTime()) && message.sender.trim())
    .sort(
      (left, right) =>
        left.message.timestamp.getTime() - right.message.timestamp.getTime() ||
        left.sourceIndex - right.sourceIndex,
    );
  const byPerson = new Map<string, typeof chronological>();

  for (const entry of chronological) {
    const existing = byPerson.get(entry.message.sender);
    if (existing) {
      existing.push(entry);
    } else {
      byPerson.set(entry.message.sender, [entry]);
    }
  }

  const selectedSourceIndexes = new Set<number>();
  for (const [sender, entries] of byPerson) {
    selectForPerson(sender, entries, perPerson, selectedSourceIndexes);
  }

  return chronological
    .filter(({ sourceIndex }) => selectedSourceIndexes.has(sourceIndex))
    .map(({ message }) => message);
}

function selectForPerson(
  sender: string,
  entries: Array<{ message: Message; sourceIndex: number }>,
  perPerson: number,
  selectedSourceIndexes: Set<number>,
): void {
  const target = Math.min(perPerson, entries.length);
  if (target === entries.length) {
    entries.forEach(({ sourceIndex }) => selectedSourceIndexes.add(sourceIndex));
    return;
  }

  const selected = new Set<number>();
  const heuristicQuota = Math.max(1, Math.floor(target * 0.24));
  addRanked(
    entries.map((entry) => ({ ...entry, score: entry.message.text.length })),
    heuristicQuota,
    selected,
  );
  addRanked(
    entries.map((entry) => ({ ...entry, score: scoreMatches(entry.message.text, LAUGH) })),
    heuristicQuota,
    selected,
    true,
  );
  addRanked(
    entries.map((entry) => ({ ...entry, score: scoreMatches(entry.message.text, KEYWORD) })),
    heuristicQuota,
    selected,
    true,
  );

  const remaining = entries.filter(({ sourceIndex }) => !selected.has(sourceIndex));
  const slots = target - selected.size;
  const random = seededRandom(sampleSeed(sender, entries));

  for (let slot = 0; slot < slots; slot += 1) {
    const start = Math.floor((slot * remaining.length) / slots);
    const end = Math.max(start, Math.floor(((slot + 1) * remaining.length) / slots) - 1);
    const pick = start + Math.floor(random() * (end - start + 1));
    const entry = remaining[pick];
    if (entry) {
      selected.add(entry.sourceIndex);
    }
  }

  for (const entry of entries) {
    if (selected.size >= target) {
      break;
    }
    selected.add(entry.sourceIndex);
  }

  selected.forEach((sourceIndex) => selectedSourceIndexes.add(sourceIndex));
}

function addRanked(
  entries: RankedMessage[],
  limit: number,
  selected: Set<number>,
  requirePositiveScore = false,
): void {
  entries
    .filter((entry) => !requirePositiveScore || entry.score > 0)
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.message.timestamp.getTime() - right.message.timestamp.getTime() ||
        left.sourceIndex - right.sourceIndex,
    )
    .slice(0, limit)
    .forEach(({ sourceIndex }) => selected.add(sourceIndex));
}

function scoreMatches(text: string, expression: RegExp): number {
  expression.lastIndex = 0;
  return Array.from(text.matchAll(expression)).length;
}

function sampleSeed(
  sender: string,
  entries: Array<{ message: Message; sourceIndex: number }>,
): number {
  const first = entries[0].message.timestamp.getTime();
  const last = entries.at(-1)!.message.timestamp.getTime();
  let hash = 2_166_136_261;

  for (const character of `${sender}|${entries.length}|${first}|${last}`) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

function seededRandom(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}
