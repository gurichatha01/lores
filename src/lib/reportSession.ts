import type { GenerateReportInput, ReportContent, ReportSessionData } from "./types";
import { isReportMode } from "./modePresets";
import {
  parseAwards,
  parseReportContent,
  parseReportStats,
  ReportValidationError,
} from "./reportValidation";

export const REPORT_SESSION_KEY = "lore.generated-report.v1";

/**
 * Set only after the server verifies a Razorpay payment signature. The trust
 * boundary is the /api/verify HMAC check; this flag just keeps the report
 * unlocked across refreshes within the same browser session.
 */
export const REPORT_UNLOCK_KEY = "lore.report-unlocked.v1";

export function createReportSession(
  input: GenerateReportInput,
  content: ReportContent,
): ReportSessionData {
  return {
    mode: input.mode,
    subtype: input.subtype,
    stats: input.stats,
    awards: input.awards,
    content,
  };
}

export function parseReportSession(serialized: string): ReportSessionData {
  let value: unknown;
  try {
    value = JSON.parse(serialized);
  } catch {
    throw new ReportValidationError("Saved report is not valid JSON.");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ReportValidationError("Saved report must be an object.");
  }

  const record = value as Record<string, unknown>;
  const expectedKeys = ["mode", "subtype", "stats", "awards", "content"];
  if (
    Object.keys(record).some((key) => !expectedKeys.includes(key)) ||
    expectedKeys.some((key) => !(key in record))
  ) {
    throw new ReportValidationError("Saved report has an invalid shape.");
  }
  if (!isReportMode(record.mode) || typeof record.subtype !== "string") {
    throw new ReportValidationError("Saved report has an unsupported mode.");
  }

  return {
    mode: record.mode,
    subtype: record.subtype,
    stats: parseReportStats(record.stats),
    awards: parseAwards(record.awards),
    content: parseReportContent(record.content),
  };
}
