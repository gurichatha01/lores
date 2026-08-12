import { formatCount, formatSpanLabel } from "./reportPresentation";
import type { ReportMode, ReportSessionData } from "./types";

export type ShareCardKind = "hero" | "award" | "verdict";

export interface ShareCardContent {
  id: string;
  kind: ShareCardKind;
  mode: ReportMode;
  eyebrow: string;
  headline: string;
  body: string;
  emoji?: string;
  fileName: string;
}

export function buildShareCards(report: ReportSessionData): ShareCardContent[] {
  const awardLines = new Map(report.content.awardLines.map((line) => [line.awardId, line.line]));
  const modeName = report.mode.replaceAll("-", " ");
  const cards: ShareCardContent[] = [
    {
      id: "hero",
      kind: "hero",
      mode: report.mode,
      eyebrow: `${modeName} report`,
      headline: formatCount(report.stats.totalMessages),
      body: `${formatCount(report.stats.totalWords)} words · ${formatSpanLabel(report.stats.spanDays)}. ${report.content.heroLine}`,
      fileName: `lore-${report.mode}-hero.png`,
    },
  ];

  for (const award of report.awards) {
    cards.push({
      id: `award-${award.id}`,
      kind: "award",
      mode: report.mode,
      eyebrow: "award unlocked",
      headline: award.label,
      body: `${award.who} — ${awardLines.get(award.id) ?? ""}`,
      emoji: award.emoji,
      fileName: `lore-${report.mode}-${award.id}.png`,
    });
  }

  cards.push({
    id: "verdict",
    kind: "verdict",
    mode: report.mode,
    eyebrow: report.mode === "roast" ? "the verdict" : "the line",
    headline: report.content.heroLine,
    body: firstSentence(report.content.narrative),
    fileName: `lore-${report.mode}-verdict.png`,
  });

  return cards;
}

function firstSentence(text: string): string {
  const match = text.trim().match(/^.*?[.!?](?:\s|$)/u);
  return (match?.[0] ?? text).trim().slice(0, 240);
}
