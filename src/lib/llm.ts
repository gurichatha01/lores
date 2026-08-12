import type { GenerateReportInput, ReportContent } from "./types";
import { getModePreset } from "./modePresets";
import { parseReportContent, ReportValidationError } from "./reportValidation";

export const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash";

function placeholderSystemPrompt(input: GenerateReportInput): string {
  const preset = getModePreset(input.mode);
  return `You write a ${preset.label} chat report for Lore.
Placeholder voice: ${preset.placeholderVoice}
Use only the supplied deterministic stats, computed awards, and curated sample.
Respect the selected mode and subtype. Do not infer romance unless the mode is Sweetheart.
Do not invent or alter numeric facts. Return only JSON matching the requested schema, with no markdown.`;
}

const REPORT_SCHEMA = {
  type: "OBJECT",
  properties: {
    title: { type: "STRING" },
    heroLine: { type: "STRING" },
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
  required: ["title", "heroLine", "highlights", "awardLines", "narrative"],
} as const;

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
  const request = {
    systemInstruction: { parts: [{ text: placeholderSystemPrompt(input) }] },
    contents: [{ role: "user", parts: [{ text: JSON.stringify(input) }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: REPORT_SCHEMA,
    },
  };
  let lastOutputError: Error | undefined;

  for (let attempt = 0; attempt < 2; attempt += 1) {
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
