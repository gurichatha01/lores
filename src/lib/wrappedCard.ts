import { getModePreset } from "./modePresets";
import {
  buildModeStatCards,
  formatCount,
  formatParticipantTitle,
  formatSpanLabel,
  formatWordCountWithNovels,
  type ModeStatCard,
} from "./reportPresentation";
import type { Award, ReportMode, ReportSessionData } from "./types";

export interface WrappedCardContent {
  mode: ReportMode;
  modeLabel: string;
  editionLabel: string;
  modeEmoji: string;
  relationshipLine: string;
  heroLabel: "total messages";
  heroValue: string;
  heroDetail: string;
  stats: readonly [ModeStatCard, ModeStatCard, ModeStatCard, ModeStatCard];
  headlineAward: Award;
  punchLine: string;
  fileName: string;
}

export function buildWrappedCard(report: ReportSessionData): WrappedCardContent {
  const preset = getModePreset(report.mode);
  const headlineAward =
    report.awards.find((award) => award.id === "main-character") ?? report.awards[0];
  if (!headlineAward) {
    throw new Error("A Wrapped card requires at least one computed award.");
  }

  const stats = buildModeStatCards(report.mode, report.stats);
  if (stats.length !== 4) {
    throw new Error("A Wrapped card requires exactly four deterministic stats.");
  }
  const span = formatSpanLabel(report.stats.spanDays).replace(", in messages", "");

  return {
    mode: report.mode,
    modeLabel: preset.label,
    editionLabel: preset.label.toLowerCase().endsWith("wrapped")
      ? preset.label
      : `${preset.label} Wrapped`,
    modeEmoji: preset.emoji,
    relationshipLine: `${formatParticipantTitle(report.stats.people)} · ${span}`,
    heroLabel: "total messages",
    heroValue: formatCount(report.stats.totalMessages),
    heroDetail: formatWordCountWithNovels(
      report.stats.totalWords,
      report.stats.novelsEquivalent,
    ),
    stats: [stats[0], stats[1], stats[2], stats[3]],
    headlineAward: { ...headlineAward },
    punchLine: report.content.wrappedLine,
    fileName: `lores-${report.mode}-wrapped.png`,
  };
}
