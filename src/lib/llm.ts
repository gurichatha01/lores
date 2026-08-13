import type { GenerateReportInput, ReportContent } from "./types";
import type { ReportMode } from "./types";
import {
  assignAwards,
  getAwardLineDirectionError,
  getAwardMetricRule,
  getAwardMetricValue,
} from "./assignAwards";
import { parseReportContent, ReportValidationError } from "./reportValidation";

export const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash";
export const NARRATIVE_LENGTH = "180–240";

const REPORT_SCHEMA = {
  type: "OBJECT",
  properties: {
    title: { type: "STRING" },
    heroLine: { type: "STRING" },
    wrappedLine: { type: "STRING" },
    highlights: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          label: { type: "STRING" },
          body: { type: "STRING" },
          bubble: { type: "STRING" },
        },
        required: ["label", "body"],
      },
    },
    awardLines: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          awardId: { type: "STRING" },
          line: { type: "STRING" },
        },
        required: ["awardId", "line"],
      },
    },
    narrative: { type: "STRING" },
    chapters: {
      type: "ARRAY",
      minItems: 4,
      maxItems: 4,
      items: {
        type: "OBJECT",
        properties: {
          title: { type: "STRING" },
          body: { type: "STRING" },
        },
        required: ["title", "body"],
      },
    },
  },
  required: ["title", "heroLine", "wrappedLine", "highlights", "awardLines", "narrative", "chapters"],
} as const;

export const MODE_VOICE_BLOCKS: Record<ReportMode, string> = {
  sweetheart:
    "💕 sweetheart (partner) — Warm, soft, and tender when the source messages are soft — always earned through specific shared details, never through love-language clichés. Take the cue from the material: if the chat is affectionate, write with genuine affection and let that softness lead; do not default to banter, savagery, sarcasm, or a roast in disguise. Tease only when the messages themselves clearly support it. Read whether it's giddy-new or comfortable-old from the data and match it. Example award line: \"replies in 90 seconds flat, unless it's 'we need to talk' — then, suddenly, offline.\" Profanity: keep this gift-and-print mode one notch cleaner than the source and use no hard profanity; soften or omit hard language even when it appears in the chat. Avoid: anything that sounds like a Hallmark card.",
  "ride-or-die":
    "👯 ride or die (best friend) — Hype + roast-with-love, best-man-speech energy. Inside jokes, the dumb stuff, unhinged loyalty shown through real receipts. You'd take a bullet for them and also expose them in the group chat. Example: \"has said 'i'm 5 min away' 47 times. has never once been 5 min away.\" Profanity: match the chat's own language and level; do not sanitize language the source naturally uses. Avoid: sentimentality without a joke attached.",
  group:
    "🏆 group wrapped (group) — Competitive, punchy, scoreboard energy. Call out the group's dynamics — the main character, the ghost, the one who only shows up to send a bill reminder. Rank, compare, stir the pot. Example: \"contributed 58% of all messages. this isn't a group chat, it's their podcast with guests.\" Profanity: match the chat's own language and level; do not sanitize language the source naturally uses. Avoid: treating everyone equally — the fun is in the differences.",
  family:
    "👨‍👩‍👧 family — Gentle and warm, lightly wry about family logistics (\"ok beta\", the forwarded good-mornings, the endless plan-coordination). Fond, never a roast. Respect the relationships while noticing the funny patterns. Example: \"sent 214 good-morning messages. read receipts: unconfirmed.\" Profanity: keep this gift-and-print mode one notch cleaner than the source and use no hard profanity; soften or omit hard language even when it appears in the chat. Avoid: anything cutting; keep it affectionate.",
  work:
    "💼 work / team — Dry, deadpan, office-in-joke. Observe work patterns — who carries the thread, the after-hours pings, the \"quick sync\" that never was. Professional enough to share with the team, witty enough that they screenshot it. Example: \"sent 61 messages after 9pm. work-life balance: a rumor.\" Profanity: match the chat's own language and level; do not sanitize language the source naturally uses. Avoid: warmth or emotion — this one runs cool.",
  roast:
    "🔥 roast — Savage but precise. The burn always comes from a real receipt or a real number — never from insults, slurs, appearance, or anything cruel about who someone is. You're roasting behavior the data proves, and specific-and-true hits ten times harder than mean-and-generic. Example: \"texts first 71% of the time and still gets left on read for a median of 3 hours. the delusion is the main character here.\" Profanity: match the chat's own language and level; do not sanitize language the source naturally uses. Hard rule: if a line would sting even if it weren't true, cut it. It has to earn the laugh with evidence.",
};

export function buildSystemPrompt(input: GenerateReportInput): string {
  return `You are the writer behind lores — an app that turns a real chat export into a report people screenshot and gift. You're given real statistics and a curated sample of real messages from ONE conversation. Your job is to write the words around the numbers: sharp, specific, and unmistakably about THESE people.

THE ONE RULE: specificity. Every sentence must be anchored to a real detail — a specific number from the stats, or a specific thing from the sample (a phrase they actually use, a topic they actually discuss, a habit visible in the data). Before you keep any sentence, ask: "Could this exact sentence appear in a stranger's report?" If yes, delete it and write something only true of these people.

BANNED WORDS (and anything like them): journey, bond, connection, sanctuary, tapestry, woven, heartbeat, warm hug, devotion, testament, speaks volumes, unbreakable, special, beautiful, cherish, treasure. They are the sound of saying nothing. If you catch yourself reaching for one, you don't have a real detail yet — go find one in the data.

TAKE YOUR CUE FROM THE MESSAGES. Match the real relationship. If the chat is playful, be playful; if it's mostly logistics, be wry about the logistics; if it's genuinely tender, earn the tenderness with a specific detail. Do NOT impose warmth, romance, or sentiment that isn't there. A boss chat is not a love story. Read the sample before you write a word.

NEVER INVENT. You only know what's in the stats and sample. If you don't have a specific detail for a point, use a specific NUMBER instead. Never fabricate events, quotes, nicknames, or people that don't appear in the data. Real-but-smaller beats impressive-but-made-up.

FIELD RULES:
- awardLines — the winner's name is already shown as a heading. Do NOT restate it or start with it. Don't describe the award ("kept us laughing as the Comedian"). State the behavior that earned it. Include the numeric value from the award's detail using digits, and obey the award wiring below. Make it land in one line.
- narrative — ${NARRATIVE_LENGTH} words. Open with a concrete detail, never a summary. Tell their actual story with their actual specifics. Close on a line that hits.
- chapters — exactly 4, chronological, forming an arc across the whole span. Use the milestone dates and the by-month data to structure it (quiet start → peak → dip → now, or whatever the data actually shows). Each title is specific to THIS chat (never "The Beginning" — something like "The Meme Era" or "The 2AM Debate Club"). Each body is 2–3 sentences grounded in real details from that stretch.
- highlights — pull real moments/patterns from the sample. Each is a genuine receipt or a specific pattern, briefly labeled.
- heroLine / title / wrappedLine — one punchy line each, specific to them, no mush.

FEW-SHOT: THE FIX, SHOWN

Award line — Comedian (detail: "143 laugh-messages"):
❌ "Guri Chatha — Guri Chatha kept us laughing as the Comedian with 143 laugh-filled messages."
✅ "143 messages that were pure keyboard-smash. Said almost nothing, carried the entire mood."

Narrative opening:
❌ "Over a beautiful span of 777 days, you've woven 6,375 messages into a sanctuary of warmth and love."
✅ "6,375 messages in two years and a solid third of them are about food. The 'murgh malai tikka vs dal roti' debate has been running since March and nobody's conceding."

Chapter:
❌ "Ch. 2 — Laughter and Sweet Comforts: With over 260 combined laughs, you've mastered the art of keeping things cozy."
✅ "Ch. 2 — The Whale Phase: for six weeks the chat was 40% Sanj's whale-communication project and 60% Guri pretending to understand it. Peak messages hit here — 199 in one day, May 19th."

The pattern every time: delete the abstraction, replace with a number or a real detail from their chat.

AWARD WIRING — NON-NEGOTIABLE:
${formatAwardWiring(input)}

GUARDRAILS:
- Roast mode: behavior-based only. No insults about appearance, identity, intelligence, or anything a person can't see in the data. The receipt does the work.
- No fabrication of quotes, events, or names — ever. Specificity must come from real data, not invention.
- If the sample is thin/sparse, say less and lean on the numbers rather than padding with mush.

VOICE FOR THIS REPORT:
${MODE_VOICE_BLOCKS[input.mode]}

Return ONLY valid JSON matching this schema, no markdown fences, no preamble:
${JSON.stringify(REPORT_SCHEMA, null, 2)}`;
}

export class LlmConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LlmConfigurationError";
  }
}

export class LlmRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LlmRequestError";
  }
}

export class LlmOutputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LlmOutputError";
  }
}

export async function generateReport(input: GenerateReportInput): Promise<ReportContent> {
  assertAwardInputsMatchStats(input);
  const provider = process.env.LLM_PROVIDER?.trim().toLowerCase() || "gemini";

  switch (provider) {
    case "gemini":
      return generateWithGemini(input);
    default:
      throw new LlmConfigurationError(`Unsupported LLM provider: ${provider}`);
  }
}

async function generateWithGemini(input: GenerateReportInput): Promise<ReportContent> {
  const apiKey = process.env.LLM_API_KEY?.trim();
  if (!apiKey) {
    throw new LlmConfigurationError("LLM_API_KEY is not configured.");
  }

  const model = process.env.LLM_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model,
  )}:generateContent`;
  let lastOutputError: Error | undefined;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const repairInstruction = lastOutputError
      ? `\n\nYour previous output failed validation: ${lastOutputError.message} Return a fresh, complete report that fixes this.`
      : "";
    const request = {
      systemInstruction: { parts: [{ text: buildSystemPrompt(input) }] },
      contents: [
        {
          role: "user",
          parts: [{ text: `${JSON.stringify(input)}${repairInstruction}` }],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: REPORT_SCHEMA,
      },
    };
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify(request),
      cache: "no-store",
    });

    if (!response.ok) {
      throw new LlmRequestError(`Gemini request failed with status ${response.status}.`);
    }

    try {
      const responseBody: unknown = await response.json();
      const content = parseReportContent(JSON.parse(stripCodeFences(extractGeminiText(responseBody))));
      assertAwardLinesMatch(input, content);
      assertAwardLinesUseWinnerMetrics(input, content);
      assertHighlightBubblesGrounded(input, content);
      return content;
    } catch (error) {
      if (!(error instanceof SyntaxError || error instanceof ReportValidationError || error instanceof LlmOutputError)) {
        throw error;
      }
      lastOutputError = error;
    }
  }

  throw new LlmOutputError(
    `Gemini returned invalid report JSON twice${lastOutputError ? `: ${lastOutputError.message}` : "."}`,
  );
}

function extractGeminiText(value: unknown): string {
  if (!value || typeof value !== "object") {
    throw new LlmOutputError("Gemini response was not an object.");
  }
  const candidates = (value as { candidates?: unknown }).candidates;
  if (!Array.isArray(candidates)) {
    throw new LlmOutputError("Gemini response had no candidates.");
  }

  const text = candidates
    .flatMap((candidate) => {
      if (!candidate || typeof candidate !== "object") {
        return [];
      }
      const content = (candidate as { content?: unknown }).content;
      if (!content || typeof content !== "object") {
        return [];
      }
      const parts = (content as { parts?: unknown }).parts;
      return Array.isArray(parts) ? parts : [];
    })
    .map((part) =>
      part && typeof part === "object" && typeof (part as { text?: unknown }).text === "string"
        ? (part as { text: string }).text
        : "",
    )
    .join("");

  if (!text.trim()) {
    throw new LlmOutputError("Gemini response contained no text.");
  }
  return text;
}

export function stripCodeFences(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/iu, "")
    .replace(/\s*```$/u, "")
    .trim();
}

function assertAwardLinesMatch(input: GenerateReportInput, content: ReportContent): void {
  const expected = input.awards.map((award) => award.id).sort();
  const actual = content.awardLines.map((line) => line.awardId).sort();
  if (expected.length !== actual.length || expected.some((awardId, index) => awardId !== actual[index])) {
    throw new LlmOutputError("Gemini must return exactly one line for every computed award.");
  }
}

function assertAwardInputsMatchStats(input: GenerateReportInput): void {
  const expected = assignAwards(input.stats);
  const actual = input.awards;
  const matches =
    expected.length === actual.length &&
    expected.every((award, index) => {
      const candidate = actual[index];
      return (
        candidate?.id === award.id &&
        candidate.label === award.label &&
        candidate.emoji === award.emoji &&
        candidate.who === award.who &&
        candidate.detail === award.detail
      );
    });
  if (!matches) {
    throw new LlmOutputError("Award winners and details must match the deterministic person metrics.");
  }
}

function assertAwardLinesUseWinnerMetrics(
  input: GenerateReportInput,
  content: ReportContent,
): void {
  const linesByAward = new Map(content.awardLines.map((line) => [line.awardId, line.line]));
  for (const award of input.awards) {
    const line = linesByAward.get(award.id)!;
    const expectedNumbers = extractNumericEvidence(award.detail);
    const actualNumbers = new Set(extractNumericEvidence(line));
    if (expectedNumbers.some((number) => !actualNumbers.has(number))) {
      throw new LlmOutputError(
        `${award.label} line must use its winner's computed detail: ${award.detail}.`,
      );
    }
    const namedRecipients = input.stats.people.filter(
      (person) => award.who === person.name || !input.stats.people.some((candidate) => candidate.name === award.who),
    );
    const repeatedName = namedRecipients.find(
      (person) => person.name.trim().length >= 2 && line.toLocaleLowerCase().includes(person.name.toLocaleLowerCase()),
    );
    if (repeatedName) {
      throw new LlmOutputError(
        `${award.label} line must not repeat the winner's name; it is already the card heading.`,
      );
    }
    const winner = input.stats.people.find((person) => person.name === award.who);
    const winnerValue = winner ? getAwardMetricValue(award.id, winner) : undefined;
    const tied =
      winnerValue !== undefined &&
      input.stats.people.filter(
        (person) => getAwardMetricValue(award.id, person) === winnerValue,
      ).length > 1;
    const directionError = getAwardLineDirectionError(award.id, line, { tied });
    if (directionError) throw new LlmOutputError(directionError);
  }
}

function formatAwardWiring(input: GenerateReportInput): string {
  return input.awards
    .map((award) => {
      const rule = getAwardMetricRule(award.id);
      if (!rule) return `- ${award.id}: unsupported award; do not write a line.`;
      const winner = input.stats.people.find((person) => person.name === award.who);
      const winnerValue = winner ? getAwardMetricValue(award.id, winner) : undefined;
      const tiedPeople =
        winnerValue === undefined
          ? []
          : input.stats.people.filter(
              (person) => getAwardMetricValue(award.id, person) === winnerValue,
            );
      const tieContext =
        tiedPeople.length > 1
          ? ` TIE RULE — MANDATORY FOR THIS LINE: ${tiedPeople.map((person) => `"${person.name}"`).join(" and ")} share this metric value. Explicitly use "tied", "shared", or "matched" in the line. Deterministic participant-order tie-break selected "${award.who}" only for display; it does NOT mean they were actually slower, faster, higher, lower, better, or worse. Treat the award label as ceremonial and never claim a strict lead.`
          : "";
      return `- ${award.label} (${award.id}): winner "${award.who}" has the ${rule.selection.toUpperCase()} ${rule.metric}, meaning ${rule.meaning}. Use numeric detail "${award.detail}". Do not repeat the winner name in the line. ${rule.lineInstruction}${tieContext}`;
    })
    .join("\n");
}

function extractNumericEvidence(value: string): string[] {
  return value.replace(/(?<=\d),(?=\d{3}\b)/gu, "").match(/\d+(?:\.\d+)?%?/gu) ?? [];
}

function assertHighlightBubblesGrounded(
  input: GenerateReportInput,
  content: ReportContent,
): void {
  const evidence = new Set(input.sample.map((message) => message.text));
  const ungrounded = content.highlights.filter(
    (highlight) => highlight.bubble !== undefined && !evidence.has(highlight.bubble),
  );
  if (ungrounded.length > 0) {
    throw new LlmOutputError(
      "Every highlight bubble must exactly match one complete message from the supplied sample.",
    );
  }
}
